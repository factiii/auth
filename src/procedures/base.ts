import { TRPCError } from '@trpc/server';

import { type AuthProcedure, type BaseProcedure } from '../types/trpc';
import { cleanBase32String, verifyTotp } from '../utilities';
import { detectBrowser } from '../utilities/browser';
import type { ResolvedAuthConfig } from '../utilities/config';
import { clearAuthCookie, setAuthCookie } from '../utilities/cookies';
import { createAuthToken } from '../utilities/jwt';
import { comparePassword, hashPassword } from '../utilities/password';
import type { SchemaExtensions } from '../types/hooks';
import {
  changePasswordSchema,
  checkPasswordResetSchema,
  endAllSessionsSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  type CreatedSchemas,
  type SignupSchemaInput,
  type LoginSchemaInput,
} from '../validators';

/**
 * Factory for core authentication procedures: register, login, logout,
 * token refresh, session management, and password reset flows.
 */
export class BaseProcedureFactory<TExtensions extends SchemaExtensions = {}> {
  constructor(
    private config: ResolvedAuthConfig,
    private procedure: BaseProcedure,
    private authProcedure: AuthProcedure
  ) {}

  /** Returns all base auth procedures to be merged into the router. */
  createBaseProcedures(schemas: CreatedSchemas<TExtensions>) {
    return {
      register: this.register(schemas.signup),
      login: this.login(schemas.login),
      logout: this.logout(),
      refresh: this.refresh(),
      endAllSessions: this.endAllSessions(),
      changePassword: this.changePassword(),
      sendPasswordResetEmail: this.sendPasswordResetEmail(),
      checkPasswordReset: this.checkPasswordReset(),
      resetPassword: this.resetPassword(),
    };
  }

  private register(schema: CreatedSchemas<TExtensions>['signup']) {
    return this.procedure.input(schema).mutation(async ({ ctx, input }) => {
      const typedInput = input as SignupSchemaInput<TExtensions>;
      const { username, email, password } = typedInput;
      const userAgent = ctx.headers['user-agent'];

      if (!userAgent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User agent not found',
        });
      }

      if (this.config.hooks?.beforeRegister) {
        await this.config.hooks.beforeRegister(typedInput);
      }

      const usernameCheck = await this.config.prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
      });

      if (usernameCheck) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account already exists with that username.',
        });
      }

      const emailCheck = await this.config.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });

      if (emailCheck) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account already exists with that email.',
        });
      }

      const hashedPassword = await hashPassword(password);

      const user = await this.config.prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          status: 'ACTIVE',
          tag: this.config.features.biometric ? 'BOT' : 'HUMAN',
          twoFaEnabled: false,
          emailVerificationStatus: 'UNVERIFIED',
          verifiedHumanAt: null,
        },
      });

      if (this.config.hooks?.onUserCreated) {
        await this.config.hooks.onUserCreated(user.id, typedInput);
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
        select: { id: true, userId: true },
      });

      if (this.config.hooks?.onSessionCreated) {
        await this.config.hooks.onSessionCreated(session.id, typedInput);
      }

      const authToken = createAuthToken(
        { id: session.id, userId: session.userId, verifiedHumanAt: null },
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

  private login(schema: CreatedSchemas<TExtensions>['login']) {
    return this.procedure.input(schema).mutation(async ({ ctx, input }) => {
      const typedInput = input as LoginSchemaInput<TExtensions>;
      const { username, password, code } = typedInput;
      const userAgent = ctx.headers['user-agent'];

      if (!userAgent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User agent not found',
        });
      }

      if (this.config.hooks?.beforeLogin) {
        await this.config.hooks.beforeLogin(typedInput);
      }

      const user = await this.config.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: username, mode: 'insensitive' } },
            { username: { equals: username, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          status: true,
          password: true,
          twoFaEnabled: true,
          email: true,
          username: true,
          oauthProvider: true,
          verifiedHumanAt: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid credentials.',
        });
      }

      if (user.status === 'DEACTIVATED') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your account has been deactivated.',
        });
      }

      if (user.status === 'BANNED') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your account has been banned.',
        });
      }

      if (!user.password) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `This account uses ${user.oauthProvider?.toLowerCase() || 'social login'}. Please use that method.`,
        });
      }

      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid credentials.',
        });
      }

      if (user.twoFaEnabled && this.config.features?.twoFa) {
        if (!code) {
          return {
            success: false,
            requires2FA: true,
          };
        }

        let validCode = false;

        const secrets = await this.config.prisma.session.findMany({
          where: { userId: user.id, twoFaSecret: { not: null } },
          select: { twoFaSecret: true },
        });

        for (const s of secrets) {
          if (s.twoFaSecret && (await verifyTotp(code, cleanBase32String(s.twoFaSecret)))) {
            validCode = true;
            break;
          }
        }

        if (!validCode) {
          const checkOTP = await this.config.prisma.oTP.findFirst({
            where: { userId: user.id, code: Number(code), expiresAt: { gte: new Date() } },
          });

          if (checkOTP) {
            validCode = true;
            await this.config.prisma.oTP.delete({
              where: { id: checkOTP.id },
            });
          }
        }

        if (!validCode) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Invalid 2FA code.',
          });
        }
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
        { id: session.id, userId: session.userId, verifiedHumanAt: user.verifiedHumanAt },
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

  private logout() {
    return this.authProcedure.meta({ ignoreExpiration: true }).mutation(async ({ ctx }) => {
      const { userId, sessionId } = ctx;

      if (sessionId) {
        await this.config.prisma.session.update({
          where: { id: sessionId },
          data: { revokedAt: new Date() },
        });

        if (userId) {
          await this.config.prisma.user.update({
            where: { id: userId },
            data: { isActive: false },
          });
        }

        if (this.config.hooks?.afterLogout) {
          await this.config.hooks.afterLogout(userId, sessionId, ctx.socketId);
        }
      }

      clearAuthCookie(ctx.res, this.config.cookieSettings, this.config.storageKeys);

      return { success: true };
    });
  }

  private refresh() {
    return this.authProcedure.query(async ({ ctx }) => {
      const session = await this.config.prisma.session.update({
        where: { id: ctx.sessionId },
        data: { lastUsed: new Date() },
        select: {
          id: true,
          userId: true,
          user: { select: { verifiedHumanAt: true } },
        },
      });

      if (this.config.hooks?.onRefresh) {
        this.config.hooks.onRefresh(session.userId).catch(() => {});
      }

      const authToken = createAuthToken(
        { id: session.id, userId: session.userId, verifiedHumanAt: session.user.verifiedHumanAt },
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

      return { success: true };
    });
  }

  private endAllSessions() {
    return this.authProcedure.input(endAllSessionsSchema).mutation(async ({ ctx, input }) => {
      const { skipCurrentSession } = input;
      const { userId, sessionId } = ctx;

      const sessionsToRevoke = await this.config.prisma.session.findMany({
        where: {
          userId,
          revokedAt: null,
          ...(skipCurrentSession ? { NOT: { id: sessionId } } : {}),
        },
        select: { socketId: true, id: true, userId: true },
      });

      await this.config.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(skipCurrentSession ? { NOT: { id: sessionId } } : {}),
        },
        data: { revokedAt: new Date() },
      });

      for (const session of sessionsToRevoke) {
        if (this.config.hooks?.onSessionRevoked) {
          await this.config.hooks.onSessionRevoked(
            session.id,
            session.socketId,
            'End all sessions'
          );
        }
      }

      if (!skipCurrentSession) {
        await this.config.prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
      }

      return { success: true, revokedCount: sessionsToRevoke.length };
    });
  }

  private changePassword() {
    return this.authProcedure.input(changePasswordSchema).mutation(async ({ ctx, input }) => {
      const { userId, sessionId } = ctx;
      const { currentPassword, newPassword } = input;

      if (currentPassword === newPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'New password cannot be the same as current password',
        });
      }

      const user = await this.config.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      if (!user.password) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This account uses social login and cannot change password.',
        });
      }

      const isMatch = await comparePassword(currentPassword, user.password);
      if (!isMatch) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Current password is incorrect',
        });
      }

      const hashedPassword = await hashPassword(newPassword);

      await this.config.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      await this.config.prisma.session.updateMany({
        where: { userId, revokedAt: null, NOT: { id: sessionId } },
        data: { revokedAt: new Date() },
      });

      if (this.config.hooks?.onPasswordChanged) {
        await this.config.hooks.onPasswordChanged(userId);
      }

      return {
        success: true,
        message: 'Password changed. You will need to re-login on other devices.',
      };
    });
  }

  private sendPasswordResetEmail() {
    return this.procedure.input(requestPasswordResetSchema).mutation(async ({ input }) => {
      const { email } = input;

      const user = await this.config.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, status: 'ACTIVE' },
        select: { id: true, password: true, email: true },
      });

      if (!user) {
        return { message: 'If an account exists with that email, a reset link has been sent.' };
      }

      if (!user.password) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This account uses social login. Please use that method.',
        });
      }

      await this.config.prisma.passwordReset.deleteMany({ where: { userId: user.id } });

      const passwordReset = await this.config.prisma.passwordReset.create({
        data: { userId: user.id },
      });

      if (this.config.emailService) {
        await this.config.emailService.sendPasswordResetEmail(user.email, String(passwordReset.id));
      }

      return { message: 'Password reset email sent.' };
    });
  }

  private checkPasswordReset() {
    return this.procedure.input(checkPasswordResetSchema).query(async ({ input }) => {
      const { token } = input;

      const passwordReset = await this.config.prisma.passwordReset.findUnique({
        where: { id: token },
        select: { id: true, createdAt: true, userId: true },
      });

      if (!passwordReset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid reset token.' });
      }

      if (
        passwordReset.createdAt.getTime() + this.config.tokenSettings.passwordResetExpiryMs <
        Date.now()
      ) {
        await this.config.prisma.passwordReset.delete({ where: { id: token } });
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Reset token expired.' });
      }

      return { valid: true };
    });
  }

  private resetPassword() {
    return this.procedure.input(resetPasswordSchema).mutation(async ({ input }) => {
      const { token, password } = input;

      const passwordReset = await this.config.prisma.passwordReset.findFirst({
        where: { id: token },
        select: { id: true, createdAt: true, userId: true },
      });

      if (!passwordReset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid reset token.' });
      }

      if (
        passwordReset.createdAt.getTime() + this.config.tokenSettings.passwordResetExpiryMs <
        Date.now()
      ) {
        await this.config.prisma.passwordReset.delete({ where: { id: token } });
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Reset token expired.' });
      }

      const hashedPassword = await hashPassword(password);

      await this.config.prisma.user.update({
        where: { id: passwordReset.userId },
        data: { password: hashedPassword },
      });

      await this.config.prisma.passwordReset.delete({ where: { id: token } });

      const sessionsToRevoke = await this.config.prisma.session.findMany({
        where: { userId: passwordReset.userId, revokedAt: null },
        select: { id: true, socketId: true, userId: true },
      });

      await this.config.prisma.session.updateMany({
        where: { userId: passwordReset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      for (const session of sessionsToRevoke) {
        if (this.config.hooks?.onSessionRevoked) {
          await this.config.hooks.onSessionRevoked(
            session.id,
            session.socketId,
            'Password reset'
          );
        }
      }

      return { message: 'Password updated. Please log in with your new password.' };
    });
  }
}
