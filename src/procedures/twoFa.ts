import { TRPCError } from '@trpc/server';

import { type AuthProcedure, type BaseProcedure } from '../types/trpc';
import type { ResolvedAuthConfig } from '../utilities/config';
import { comparePassword } from '../utilities/password';
import {
  cleanBase32String,
  generateOtp,
  generateTotpSecret,
  verifyTotp
} from '../utilities/totp';
import {
  deregisterPushTokenSchema,
  disableTwofaSchema,
  getTwofaSecretSchema,
  registerPushTokenSchema,
  twoFaResetSchema,
  twoFaResetVerifySchema
} from '../validators';

/** Factory for 2FA procedures: enable/disable, TOTP secrets, and reset flows. */
export class TwoFaProcedureFactory {
  constructor(
    private config: ResolvedAuthConfig,
    private procedure: BaseProcedure,
    private authProcedure: AuthProcedure
  ) {}

  createTwoFaProcedures() {
    return {
      enableTwofa: this.enableTwofa(),
      disableTwofa: this.disableTwofa(),
      getTwofaSecret: this.getTwofaSecret(),
      twoFaReset: this.twoFaReset(),
      twoFaResetVerify: this.twoFaResetVerify(),
      registerPushToken: this.registerPushToken(),
      deregisterPushToken: this.deregisterPushToken()
    };
  }

  private checkConfig() {
    if (!this.config.features.twoFa) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
  }

  private enableTwofa() {
    return this.authProcedure.mutation(async ({ ctx }) => {
      this.checkConfig();
      const { userId, sessionId } = ctx;

      const user = await this.config.prisma.user.findFirst({
        where: { id: userId },
        select: { twoFaEnabled: true, oauthProvider: true, password: true }
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      }

      if (user.oauthProvider) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '2FA is not available for social login accounts.'
        });
      }

      if (user.twoFaEnabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA already enabled.' });
      }

      if (this.config.features.twoFaRequiresDevice !== false) {
        const checkSession = await this.config.prisma.session.findFirst({
          where: { userId, id: sessionId },
          select: { deviceId: true }
        });

        if (!checkSession?.deviceId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You must be logged in on mobile to enable 2FA.'
          });
        }
      }

      await this.config.prisma.session.updateMany({
        where: { userId, revokedAt: null, NOT: { id: sessionId } },
        data: { revokedAt: new Date() }
      });

      await this.config.prisma.session.updateMany({
        where: { userId, NOT: { id: sessionId } },
        data: { twoFaSecret: null }
      });

      const secret = generateTotpSecret();

      await this.config.prisma.user.update({
        where: { id: userId },
        data: { twoFaEnabled: true }
      });

      await this.config.prisma.session.update({
        where: { id: sessionId },
        data: { twoFaSecret: secret }
      });

      if (this.config.hooks?.onTwoFaStatusChanged) {
        await this.config.hooks.onTwoFaStatusChanged(userId, true);
      }

      return { secret };
    });
  }

  private disableTwofa() {
    return this.authProcedure
      .input(disableTwofaSchema)
      .mutation(async ({ ctx, input }) => {
        this.checkConfig();
        const { userId, sessionId } = ctx;
        const { password } = input;

        const user = await this.config.prisma.user.findFirst({
          where: { id: userId },
          select: { password: true, status: true, oauthProvider: true }
        });

        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        }

        if (user.status !== 'ACTIVE') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Account deactivated.' });
        }

        if (user.oauthProvider) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '2FA is not available for social login accounts.'
          });
        }

        if (!user.password) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot verify password for social login account.'
          });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Incorrect password.' });
        }

        await this.config.prisma.user.update({
          where: { id: userId },
          data: { twoFaEnabled: false }
        });

        await this.config.prisma.session.update({
          where: { id: sessionId },
          data: { twoFaSecret: null }
        });

        if (this.config.hooks?.onTwoFaStatusChanged) {
          await this.config.hooks.onTwoFaStatusChanged(userId, false);
        }

        return { disabled: true };
      });
  }

  private getTwofaSecret() {
    return this.authProcedure
      .input(getTwofaSecretSchema)
      .query(async ({ ctx, input }) => {
        this.checkConfig();
        const { userId, sessionId } = ctx;
        const { pushCode } = input;

        const user = await this.config.prisma.user.findFirst({
          where: { id: userId },
          select: { twoFaEnabled: true, oauthProvider: true }
        });

        if (user?.oauthProvider) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '2FA is not available for social login accounts.'
          });
        }

        if (!user?.twoFaEnabled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA not enabled.' });
        }

        const session = await this.config.prisma.session.findUnique({
          where: { id: sessionId, userId },
          select: { twoFaSecret: true, device: { select: { pushToken: true } } }
        });

        if (!session?.device) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid request' });
        }

        const expectedCode = await verifyTotp(pushCode, cleanBase32String(session.device.pushToken));
        if (!expectedCode) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid request' });
        }

        if (session.twoFaSecret) {
          return { secret: session.twoFaSecret };
        }

        const secret = generateTotpSecret();
        await this.config.prisma.session.update({
          where: { id: sessionId },
          data: { twoFaSecret: secret }
        });
        return { secret };
      });
  }

  private twoFaReset() {
    return this.procedure
      .input(twoFaResetSchema)
      .mutation(async ({ input }) => {
        this.checkConfig();
        const { username, password } = input;

        const user = await this.config.prisma.user.findFirst({
          where: { username: { equals: username, mode: 'insensitive' }, twoFaEnabled: true },
          select: { id: true, password: true, email: true }
        });

        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials.' });
        }

        if (!user.password) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Social login accounts cannot use 2FA reset.'
          });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid credentials.' });
        }

        const otp = generateOtp();
        await this.config.prisma.oTPBasedLogin.create({
          data: { userId: user.id, code: otp }
        });

        if (this.config.emailService) {
          await this.config.emailService.sendOTPEmail(user.email, otp);
        }

        return { success: true };
      });
  }

  private twoFaResetVerify() {
    return this.procedure
      .input(twoFaResetVerifySchema)
      .mutation(async ({ input }) => {
        this.checkConfig();
        const { code, username } = input;

        const user = await this.config.prisma.user.findFirst({
          where: { username: { equals: username, mode: 'insensitive' } },
          select: { id: true }
        });

        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        const otp = await this.config.prisma.oTPBasedLogin.findFirst({
          where: {
            userId: user.id,
            code,
            disabled: false,
            createdAt: { gte: new Date(Date.now() - this.config.tokenSettings.otpValidityMs) }
          }
        });

        if (!otp) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid or expired OTP' });
        }

        await this.config.prisma.oTPBasedLogin.update({
          where: { id: otp.id },
          data: { disabled: true }
        });

        await this.config.prisma.user.update({
          where: { id: user.id },
          data: { twoFaEnabled: false }
        });

        await this.config.prisma.session.updateMany({
          where: { userId: user.id },
          data: { twoFaSecret: null }
        });

        return { success: true, message: '2FA has been reset.' };
      });
  }

  private registerPushToken() {
    return this.authProcedure
      .input(registerPushTokenSchema)
      .mutation(async ({ ctx, input }) => {
        this.checkConfig();
        const { userId, sessionId } = ctx;
        const { pushToken } = input;

        await this.config.prisma.session.updateMany({
          where: {
            userId,
            id: { not: sessionId },
            revokedAt: null,
            device: { pushToken }
          },
          data: { revokedAt: new Date() }
        });

        const checkDevice = await this.config.prisma.device.findFirst({
          where: {
            pushToken,
            sessions: { some: { id: sessionId } },
            users: { some: { id: userId } }
          },
          select: { id: true }
        });

        if (!checkDevice) {
          await this.config.prisma.device.upsert({
            where: { pushToken },
            create: {
              pushToken,
              sessions: { connect: { id: sessionId } },
              users: { connect: { id: userId } }
            },
            update: {
              sessions: { connect: { id: sessionId } },
              users: { connect: { id: userId } }
            }
          });
        }

        return { registered: true };
      });
  }

  private deregisterPushToken() {
    return this.authProcedure
      .meta({ ignoreExpiration: true })
      .input(deregisterPushTokenSchema)
      .mutation(async ({ ctx, input }) => {
        this.checkConfig();
        const { userId } = ctx;
        const { pushToken } = input;

        const device = await this.config.prisma.device.findFirst({
          where: {
            ...(userId !== 0 && { users: { some: { id: userId } } }),
            pushToken
          },
          select: { id: true }
        });

        if (device) {
          await this.config.prisma.device.delete({
            where: { id: device.id }
          });
        }

        return { deregistered: true };
      });
  }
}
