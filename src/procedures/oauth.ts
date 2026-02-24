import { TRPCError } from '@trpc/server';

import type { SchemaExtensions } from '../types/hooks';
import { type BaseProcedure } from '../types/trpc';
import { createAuthToken, detectBrowser, setAuthCookie } from '../utilities';
import type { ResolvedAuthConfig } from '../utilities/config';
import { createOAuthVerifier, type OAuthProvider, type OAuthResult } from '../utilities/oauth';
import { type CreatedSchemas, type OAuthSchemaInput } from '../validators';

/** Factory for OAuth login procedures (Google, Apple). */
export class OAuthLoginProcedureFactory<TExtensions extends SchemaExtensions = {}> {
  private verifyOAuthToken:
    | ((provider: OAuthProvider, token: string, extra?: { email?: string }) => Promise<OAuthResult>)
    | null = null;

  constructor(
    private config: ResolvedAuthConfig,
    private procedure: BaseProcedure
  ) {
    if (config.oauthKeys) {
      this.verifyOAuthToken = createOAuthVerifier(config.oauthKeys);
    }
  }

  createOAuthLoginProcedures(schemas: CreatedSchemas<TExtensions>) {
    return { oAuthLogin: this.oAuthLogin(schemas.oauth) };
  }

  private checkConfig() {
    if (!this.config.features.oauth?.google && !this.config.features.oauth?.apple) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
  }

  private oAuthLogin(schema: CreatedSchemas<TExtensions>['oauth']) {
    return this.procedure.input(schema).mutation(async ({ ctx, input }) => {
      this.checkConfig();

      const typedInput = input as OAuthSchemaInput<TExtensions>;
      const { idToken, user: appleUser, provider } = typedInput;
      const userAgent = ctx.headers['user-agent'];

      if (!userAgent) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User agent not found' });
      }

      if (!this.verifyOAuthToken) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'OAuth not configured. Provide oauthKeys in config.',
        });
      }

      const { email, oauthId } = await this.verifyOAuthToken(provider, idToken, appleUser);

      if (!email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email not provided by OAuth provider',
        });
      }

      let user = await this.config.prisma.user.findFirst({
        where: {
          OR: [{ email: { equals: email, mode: 'insensitive' } }, { oauthId: { equals: oauthId } }],
        },
        select: {
          id: true,
          status: true,
          email: true,
          username: true,
          password: true,
          oauthProvider: true,
          oauthId: true,
          twoFaEnabled: true,
          verifiedHumanAt: true,
          emailVerificationStatus: true,
        },
      });

      if (user?.oauthProvider && user.oauthProvider !== provider) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `This email uses ${user.oauthProvider.toLowerCase()} sign-in.`,
        });
      }

      if (user && !user.oauthProvider && user.password) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This email uses password login. Please use email/password.',
        });
      }

      if (!user) {
        const generateUsername = this.config.generateUsername ?? (() => `user_${Date.now()}`);

        user = await this.config.prisma.user.create({
          data: {
            username: generateUsername(),
            email,
            password: null,
            emailVerificationStatus: 'VERIFIED',
            oauthProvider: provider,
            oauthId,
            status: 'ACTIVE',
            tag: this.config.features.biometric ? 'BOT' : 'HUMAN',
            twoFaEnabled: false,
            verifiedHumanAt: null,
          },
        });

        if (this.config.hooks?.onUserCreated) {
          await this.config.hooks.onUserCreated(user.id, typedInput);
        }

        if (this.config.hooks?.onOAuthLinked) {
          await this.config.hooks.onOAuthLinked(user.id, provider);
        }
      }

      if (user.status === 'DEACTIVATED') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Your account has been deactivated.' });
      }

      if (user.status === 'BANNED') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Your account has been banned.' });
      }

      const extraSessionData = this.config.hooks?.getSessionData
        ? await this.config.hooks.getSessionData(typedInput)
        : {};

      const session = await this.config.prisma.session.create({
        data: {
          userId: user.id,
          browserName: detectBrowser(userAgent),
          socketId: null,
          ...extraSessionData,
        },
        select: {
          id: true,
          userId: true,
          socketId: true,
          browserName: true,
          issuedAt: true,
          lastUsed: true,
          revokedAt: true,
          deviceId: true,
          twoFaSecret: true,
        },
      });

      if (this.config.hooks?.onUserLogin) {
        await this.config.hooks.onUserLogin(user.id, session.id);
      }

      if (this.config.hooks?.onSessionCreated) {
        await this.config.hooks.onSessionCreated(session.id, typedInput);
      }

      const authToken = createAuthToken(
        { id: session.id, userId: session.userId, verifiedHumanAt: user.verifiedHumanAt ?? null },
        {
          secret: this.config.secrets.jwt,
          expiresIn: this.config.tokenSettings.jwtExpiry,
        }
      );

      setAuthCookie(
        ctx.res,
        authToken,
        this.config.cookieSettings,
        this.config.storageKeys
      );

      return {
        success: true,
        user: { id: user.id, email: user.email, username: user.username },
      };
    });
  }
}
