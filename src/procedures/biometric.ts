import { TRPCError } from '@trpc/server';

import { type AuthProcedure } from '../types/trpc';
import type { ResolvedAuthConfig } from '../utilities/config';
import { biometricVerifySchema } from '../validators';

/** Factory for biometric verification procedures. */
export class BiometricProcedureFactory {
  constructor(
    private config: ResolvedAuthConfig,
    private authProcedure: AuthProcedure
  ) {}

  createBiometricProcedures() {
    return {
      verifyBiometric: this.verifyBiometric(),
      getBiometricStatus: this.getBiometricStatus()
    };
  }

  private checkConfig() {
    if (!this.config.features.biometric) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
  }

  private verifyBiometric() {
    return this.authProcedure
      .input(biometricVerifySchema)
      .mutation(async ({ ctx }) => {
        this.checkConfig();
        const { userId } = ctx;

        await this.config.prisma.user.update({
          where: { id: userId },
          data: { verifiedHumanAt: new Date(), tag: 'HUMAN' }
        });

        if (this.config.hooks?.onBiometricVerified) {
          await this.config.hooks.onBiometricVerified(userId);
        }

        return { success: true, verifiedAt: new Date() };
      });
  }

  private getBiometricStatus() {
    return this.authProcedure.query(async ({ ctx }) => {
      this.checkConfig();
      const { userId } = ctx;

      const user = await this.config.prisma.user.findUnique({
        where: { id: userId },
        select: { verifiedHumanAt: true }
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      let timeoutMs: number | null = null;
      if (this.config.hooks?.getBiometricTimeout) {
        timeoutMs = await this.config.hooks.getBiometricTimeout();
      }

      let isExpired = false;
      if (user.verifiedHumanAt && timeoutMs !== null) {
        const expiresAt = new Date(user.verifiedHumanAt.getTime() + timeoutMs);
        isExpired = new Date() > expiresAt;
      }

      return {
        verifiedHumanAt: user.verifiedHumanAt,
        isVerified: !!user.verifiedHumanAt && !isExpired,
        isExpired,
        requiresVerification: timeoutMs !== null
      };
    });
  }
}
