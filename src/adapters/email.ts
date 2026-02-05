/* eslint-disable no-console */
/**
 * Email service adapter interface
 * Implement this interface to integrate your email service
 */
export interface EmailAdapter {
  /**
   * Send email verification email with OTP code
   */
  sendVerificationEmail(email: string, code: string): Promise<void>;

  /**
   * Send password reset email with token/link
   */
  sendPasswordResetEmail(email: string, token: string): Promise<void>;

  /**
   * Send OTP for passwordless login or 2FA reset
   */
  sendOTPEmail(email: string, otp: number): Promise<void>;

  /**
   * Send login notification to existing devices
   */
  sendLoginNotification?(email: string, browserName: string, ip?: string): Promise<void>;
}

/**
 * No-op email adapter as default
 */
export function createNoopEmailAdapter(): EmailAdapter {
  return {
    async sendVerificationEmail(email: string, code: string) {
      console.debug(
        `[NoopEmailAdapter] Would send verification email to ${email} with code ${code}`
      );
    },
    async sendPasswordResetEmail(email: string, token: string) {
      console.debug(
        `[NoopEmailAdapter] Would send password reset email to ${email} with token ${token}`
      );
    },
    async sendOTPEmail(email: string, otp: number) {
      console.debug(`[NoopEmailAdapter] Would send OTP email to ${email} with code ${otp}`);
    },
    async sendLoginNotification(email: string, browserName: string, ip?: string) {
      console.debug(
        `[NoopEmailAdapter] Would send login notification to ${email} from ${browserName} (${ip})`
      );
    },
  };
}

/**
 * Console email adapter for development - logs emails to console
 */
export function createConsoleEmailAdapter(): EmailAdapter {
  return {
    async sendVerificationEmail(email: string, code: string) {
      console.log('\n=== EMAIL: Verification ===');
      console.log(`To: ${email}`);
      console.log(`Code: ${code}`);
      console.log('===========================\n');
    },
    async sendPasswordResetEmail(email: string, token: string) {
      console.log('\n=== EMAIL: Password Reset ===');
      console.log(`To: ${email}`);
      console.log(`Token: ${token}`);
      console.log('=============================\n');
    },
    async sendOTPEmail(email: string, otp: number) {
      console.log('\n=== EMAIL: OTP Login ===');
      console.log(`To: ${email}`);
      console.log(`OTP: ${otp}`);
      console.log('========================\n');
    },
    async sendLoginNotification(email: string, browserName: string, ip?: string) {
      console.log('\n=== EMAIL: Login Notification ===');
      console.log(`To: ${email}`);
      console.log(`Browser: ${browserName}`);
      console.log(`IP: ${ip || 'Unknown'}`);
      console.log('=================================\n');
    },
  };
}
