import { createNoopEmailAdapter } from '../adapters';
import type { CookieSettings } from '../types';
import type { AuthConfig, AuthFeatures, TokenSettings } from '../types/config';

export type { AuthConfig, AuthFeatures, TokenSettings } from '../types/config';
export type { OAuthKeys } from './oauth';

/**
 * Default token settings
 */
export const defaultTokenSettings: TokenSettings = {
  accessTokenExpiry: '5m',
  passwordResetExpiryMs: 60 * 60 * 1000, // 1 hour
  otpValidityMs: 15 * 60 * 1000 // 15 minutes
};

/**
 * Default cookie settings
 */
export const defaultCookieSettings: CookieSettings = {
  secure: true,
  sameSite: 'Strict',
  httpOnly: true,
  accessTokenPath: '/',
  refreshTokenPath: '/api/trpc/auth.refresh',
  maxAge: 365 * 24 * 60 * 60 // 1 year in seconds
};

/**
 * Default storage keys
 */
export const defaultStorageKeys = {
  accessToken: 'auth-at',
  refreshToken: 'auth-rt'
};

/**
 * Default feature flags (all optional features disabled)
 */
export const defaultFeatures: AuthFeatures = {
  twoFa: true,
  oauth: { google: true, apple: true },
  biometric: false,
  emailVerification: true,
  passwordReset: true,
  otpLogin: true
};

/**
 * Create a fully resolved auth config with defaults applied
 */
export function createAuthConfig(
  config: AuthConfig
): Required<Omit<AuthConfig, 'hooks' | 'oauthKeys' | 'schemaExtensions'>> &
  AuthConfig {
  const emailService = config.emailService ?? createNoopEmailAdapter();
  return {
    ...config,
    features: { ...defaultFeatures, ...config.features },
    tokenSettings: { ...defaultTokenSettings, ...config.tokenSettings },
    cookieSettings: { ...defaultCookieSettings, ...config.cookieSettings },
    storageKeys: { ...defaultStorageKeys, ...config.storageKeys },
    generateUsername: config.generateUsername ?? (() => `user_${Date.now()}`),
    emailService
  };
}

export type ResolvedAuthConfig = ReturnType<typeof createAuthConfig>;

/**
 * Default auth config (requires prisma and secrets to be provided)
 */
export const defaultAuthConfig = {
  features: defaultFeatures,
  tokenSettings: defaultTokenSettings,
  cookieSettings: defaultCookieSettings,
  storageKeys: defaultStorageKeys
};
