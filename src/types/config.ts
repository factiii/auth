import { type PrismaClient } from '@prisma/client';

import { type EmailAdapter } from '../adapters';
import { type CookieSettings } from '../types';
import type { OAuthKeys } from '../utilities/oauth';
import { type AuthHooks, type SchemaExtensions } from './hooks';

// Re-export SchemaExtensions for backwards compatibility
export type { SchemaExtensions } from './hooks';

/**
 * Token and OTP expiry settings
 */
export interface TokenSettings {
  /** JWT expiry in seconds (default: 30 days) */
  jwtExpiry: number;
  /** Password reset token expiry in ms (default: 1 hour) */
  passwordResetExpiryMs: number;
  /** OTP validity window in ms (default: 15 minutes) */
  otpValidityMs: number;
}

/**
 * Feature flags for optional auth features
 */
export interface AuthFeatures {
  /** Enable two-factor authentication */
  twoFa?: boolean;
  /** Require mobile device to enable 2FA (default: true). Set to false for testing. */
  twoFaRequiresDevice?: boolean;
  /** OAuth providers configuration */
  oauth?: {
    google?: boolean;
    apple?: boolean;
  };
  /** Enable biometric verification */
  biometric?: boolean;
  /** Enable email verification */
  emailVerification?: boolean;
  /** Enable password reset via email */
  passwordReset?: boolean;
  /** Enable OTP-based login */
  otpLogin?: boolean;
}

export interface AuthConfig<TExtensions extends SchemaExtensions = {}> {
  /**
   * Prisma client instance with required models
   */
  prisma: PrismaClient;

  /**
   * Secret keys for JWT signing
   */
  secrets: {
    jwt: string;
  };

  /**
   * Email service adapter for sending verification/reset emails
   */
  emailService?: EmailAdapter;

  /**
   * Lifecycle hooks for business logic
   * Receives extended input types based on schemaExtensions
   */
  hooks?: AuthHooks<TExtensions>;

  /**
   * Feature flags
   */
  features?: AuthFeatures;

  /**
   * Token expiry settings
   */
  tokenSettings?: TokenSettings;

  /**
   * Cookie configuration
   */
  cookieSettings?: Partial<CookieSettings>;

  /**
   * OAuth keys for Google and Apple providers
   * Required if OAuth is enabled
   */
  oauthKeys?: OAuthKeys;

  /**
   * Username generator for OAuth signups
   * Defaults to a simple email-based generator
   */
  generateUsername?: () => string;

  /**
   * Cookie storage keys
   */
  storageKeys?: {
    authToken: string;
  };

  /**
   * Schema extensions for adding custom fields to auth inputs
   * Extensions are merged with base schemas and validated automatically
   * Custom fields are then available in hooks with proper typing
   */
  schemaExtensions?: TExtensions;
}
