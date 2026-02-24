import { TRPCError } from '@trpc/server';

import { type AuthConfig } from '../types/config';
import { type TrpcBuilder, type TrpcContext } from '../types/trpc';
import { defaultCookieSettings, defaultStorageKeys } from '../utilities/config';
import { clearAuthCookie, parseAuthCookie } from '../utilities/cookies';
import { isTokenExpiredError, isTokenInvalidError, verifyAuthToken } from '../utilities/jwt';

export function createAuthGuard(config: AuthConfig, t: TrpcBuilder) {
  const storageKeys = config.storageKeys ?? defaultStorageKeys;
  const cookieSettings = { ...defaultCookieSettings, ...config.cookieSettings };

  const revokeSession = async (
    ctx: TrpcContext,
    sessionId: number | null,
    description: string,
    errorStack?: string | null,
    path?: string
  ) => {
    clearAuthCookie(ctx.res, cookieSettings, storageKeys);

    // Log session revocations for security auditing
    if (config.hooks?.logError) {
      try {
        const cookieHeader = ctx.headers.cookie;
        const contextInfo = {
          reason: description,
          sessionId,
          userId: ctx.userId,
          ip: ctx.ip,
          userAgent: ctx.headers['user-agent'],
          ...(path ? { path } : {}),
          hasCookieHeader: Boolean(cookieHeader),
          cookieKeys: cookieHeader
            ? cookieHeader
                .split(';')
                .map((c) => c.trim().split('=')[0])
                .filter(Boolean)
            : [],
          origin: ctx.headers.origin ?? null,
          referer: ctx.headers.referer ?? null,
          timestamp: new Date().toISOString()
        };

        const combinedStack = [
          errorStack ? `Error Stack:\n${errorStack}` : null,
          'Context:',
          JSON.stringify(contextInfo, null, 2),
        ]
          .filter(Boolean)
          .join('\n\n');

        await config.hooks.logError({
          type: 'SECURITY',
          description: `Session revoked: ${description}`,
          stack: combinedStack,
          ip: ctx.ip,
          userId: ctx.userId ?? null,
        });
      } catch {
        // Silently fail - don't let error logging prevent session revocation
      }
    }

    if (sessionId) {
      try {
        await config.prisma.session.update({
          where: { id: sessionId },
          data: { revokedAt: new Date() },
        });

        if (config.hooks?.onSessionRevoked) {
          const session = await config.prisma.session.findUnique({
            where: { id: sessionId },
            select: { id: true, userId: true, socketId: true },
          });
          if (session) {
            await config.hooks.onSessionRevoked(session.userId, session.socketId, description);
          }
        }
      } catch {
        // Session may already be revoked or deleted
      }
    }
  };

  const authGuard = t.middleware(async ({ ctx, meta, next, path }) => {
    const cookies = parseAuthCookie(ctx.headers.cookie, storageKeys);
    const authToken = cookies.authToken;
    const userAgent = ctx.headers['user-agent'];

    if (!userAgent) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User agent is required',
      });
    }

    // If auth token is present, validate it
    if (authToken) {
      try {
        const decodedToken = verifyAuthToken(authToken, {
          secret: config.secrets.jwt,
          ignoreExpiration: meta?.ignoreExpiration ?? false,
        });

        // Find session in database
        const session = await config.prisma.session.findUnique({
          where: {
            id: decodedToken.id,
          },
          select: {
            userId: true,
            user: {
              select: {
                status: true,
                verifiedHumanAt: true,
              },
            },
            revokedAt: true,
            socketId: true,
            id: true,
          },
        });

        if (!session) {
          await revokeSession(
            ctx,
            decodedToken.id,
            'Session revoked: Session not found',
            undefined,
            path
          );
          throw new TRPCError({
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        // Check user status
        if (session.user.status === 'BANNED') {
          await revokeSession(ctx, session.id, 'Session revoked: User banned', undefined, path);
          throw new TRPCError({
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        // Check biometric verification if enabled
        if (config.features?.biometric && config.hooks?.getBiometricTimeout) {
          const timeoutMs = await config.hooks.getBiometricTimeout();

          if (
            timeoutMs !== null &&
            !['auth.refresh', 'auth.verifyBiometric', 'auth.logout'].includes(path)
          ) {
            if (!session.user.verifiedHumanAt) {
              throw new TRPCError({
                message: 'Biometric verification not completed. Please verify again.',
                code: 'FORBIDDEN',
              });
            }

            const now = new Date();
            const verificationExpiry = new Date(session.user.verifiedHumanAt.getTime() + timeoutMs);

            if (now > verificationExpiry) {
              throw new TRPCError({
                message: 'Biometric verification expired. Please verify again.',
                code: 'FORBIDDEN',
              });
            }
          }
        }

        // Check if session is revoked
        if (session.revokedAt) {
          await revokeSession(
            ctx,
            session.id,
            'Session revoked: Session already revoked',
            undefined,
            path
          );
          throw new TRPCError({
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        // Check admin authorization if required
        if (meta?.adminRequired) {
          const admin = await config.prisma.admin.findFirst({
            where: { userId: session.userId },
            select: { ip: true },
          });

          if (!admin || admin.ip !== ctx.ip) {
            await revokeSession(
              ctx,
              session.id,
              'Session revoked: Admin not found or IP mismatch',
              undefined,
              path
            );
            throw new TRPCError({
              message: 'Unauthorized',
              code: 'UNAUTHORIZED',
            });
          }
        }

        // Session is valid, proceed with authenticated context
        return next({
          ctx: {
            ...ctx,
            userId: session.userId,
            socketId: session.socketId,
            sessionId: session.id,
          },
        });
      } catch (err: unknown) {
        if (err instanceof TRPCError && err.code === 'FORBIDDEN') {
          throw err;
        }

        // If auth is not required, continue with unauthenticated context
        if (!meta?.authRequired) {
          return next({ ctx: { ...ctx, userId: 0 } });
        }

        const errorStack = err instanceof Error ? err.stack : undefined;

        if (isTokenExpiredError(err) || isTokenInvalidError(err)) {
          await revokeSession(
            ctx,
            null,
            isTokenInvalidError(err)
              ? 'Session revoked: Token invalid'
              : 'Session revoked: Token expired',
            errorStack,
            path
          );
          throw new TRPCError({
            message: isTokenInvalidError(err) ? 'Token invalid' : 'Token expired',
            code: 'UNAUTHORIZED',
          });
        }

        if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
          await revokeSession(ctx, null, 'Session revoked: Unauthorized', errorStack, path);
          throw new TRPCError({
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        throw err;
      }
    } else {
      // No auth token present
      if (!meta?.authRequired) {
        return next({ ctx: { ...ctx, userId: 0 } });
      }

      await revokeSession(ctx, null, 'Session revoked: No token sent', undefined, path);
      throw new TRPCError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  });

  return authGuard;
}
