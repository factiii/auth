export type { AuthRouter } from './router';
export { createAuthRouter } from './router';
export type { AuthConfig, AuthFeatures, SchemaExtensions, TokenSettings } from './types/config';
export type { AuthHooks } from './types/hooks';
export type { TrpcContext } from './types/trpc';
export {
  createAuthConfig,
  defaultAuthConfig,
  defaultCookieSettings,
  defaultStorageKeys,
  defaultTokenSettings,
} from './utilities/config';

export type { OAuthKeys, OAuthProvider, OAuthResult } from './utilities/oauth';
export { createOAuthVerifier, OAuthVerificationError } from './utilities/oauth';

export { createAuthGuard } from './middleware/authGuard';

export type { EmailAdapter } from './adapters/email';
export { createConsoleEmailAdapter, createNoopEmailAdapter } from './adapters/email';

export { detectBrowser, isMobileDevice, isNativeApp } from './utilities/browser';
export {
  clearAuthCookies,
  DEFAULT_STORAGE_KEYS,
  parseAuthCookies,
  setAuthCookies,
} from './utilities/cookies';
export {
  createAccessToken,
  decodeToken,
  isTokenExpiredError,
  isTokenInvalidError,
  verifyAccessToken,
} from './utilities/jwt';
export { comparePassword, hashPassword, validatePasswordStrength } from './utilities/password';
export {
  cleanBase32String,
  generateOtp,
  generateTotpCode,
  generateTotpSecret,
  verifyTotp,
} from './utilities/totp';

export type {
  ChangePasswordInput,
  LoginInput,
  LogoutInput,
  OAuthLoginInput,
  ResetPasswordInput,
  SignupInput,
  TwoFaVerifyInput,
  VerifyEmailInput,
} from './validators';
export {
  biometricVerifySchema,
  changePasswordSchema,
  endAllSessionsSchema,
  loginSchema,
  logoutSchema,
  oAuthLoginSchema,
  otpLoginRequestSchema,
  otpLoginVerifySchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signupSchema,
  twoFaResetSchema,
  twoFaSetupSchema,
  twoFaVerifySchema,
  verifyEmailSchema,
} from './validators';
