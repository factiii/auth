import { initTRPC } from '@trpc/server';
import { type IncomingMessage } from 'http';
import SuperJSON from 'superjson';
import { ZodError } from 'zod';

import { type createAuthGuard } from '../middleware/authGuard';
import { type Meta, type TrpcBuilder, type TrpcContext } from '../types/trpc';
import { type ResolvedAuthConfig } from './config';

/**
 * Checks if an error is a Prisma connection error (infrastructure issue).
 * Connection errors are P1000-P1003:
 * - P1000: Authentication failed
 * - P1001: Can't reach database server
 * - P1002: Database server timeout
 * - P1003: Database does not exist
 */
function isPrismaConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // Check for Prisma error code
  const errorCode = (error as { code?: string }).code;
  if (errorCode && typeof errorCode === 'string') {
    const codeMatch = errorCode.match(/^P(\d+)$/);
    if (codeMatch) {
      const codeNum = parseInt(codeMatch[1], 10);
      if (codeNum >= 1000 && codeNum <= 1003) {
        return true;
      }
    }
  }

  // Check error constructor name for Prisma connection errors
  const constructorName = error.constructor?.name || '';
  if (constructorName.includes('Prisma')) {
    const errorMessage =
      (error as { message?: string }).message?.toLowerCase() || '';
    if (
      errorMessage.includes("can't reach database") ||
      errorMessage.includes('authentication failed') ||
      errorMessage.includes('database server') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection')
    ) {
      return true;
    }
  }

  // Check error.cause recursively
  const cause = (error as { cause?: unknown }).cause;
  if (cause) {
    return isPrismaConnectionError(cause);
  }

  return false;
}

export function createTrpcBuilder(config: ResolvedAuthConfig) {
  return initTRPC
    .context<TrpcContext>()
    .meta<Meta>()
    .create({
      transformer: SuperJSON,
      errorFormatter: (opts) => {
        const { shape, error } = opts;

        const { stack: _stack, ...safeData } = shape.data;

        // Handle 500 errors
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          if (config.hooks?.logError) {
            const errorType =
              isPrismaConnectionError(error) ||
              isPrismaConnectionError(error.cause)
                ? 'DATABASE_ERROR'
                : 'SERVER_ERROR';

            config.hooks
              .logError({
                type: errorType,
                description: error.message,
                stack: error.stack || 'No stack trace',
                ip: opts.ctx?.ip,
                userId: opts.ctx?.userId ?? null
              })
              .catch(() => {
                // Silently fail - error logging should never throw
              });
          }

          // Customize the error message for users
          return {
            ...shape,
            message: 'An unexpected error occurred. Please try again later.',
            data: {
              ...safeData,
              zodError:
                error.cause instanceof ZodError ? error.cause.flatten() : null
            }
          };
        }

        return {
          ...shape,
          data: {
            ...safeData,
            zodError:
              error.cause instanceof ZodError ? error.cause.flatten() : null
          }
        };
      }
    });
}

export function createBaseProcedure(
  t: TrpcBuilder,
  authGuard: ReturnType<typeof createAuthGuard>
) {
  return t.procedure.use(authGuard);
}

export function getClientIp(req: IncomingMessage): string | undefined {
  // Check for the X-Forwarded-For header
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;

  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }

  // Fallback to the connection's remote address
  return req.socket.remoteAddress || undefined;
}
