import { type z, type AnyZodObject } from 'zod';

import {
  type loginSchema,
  type oAuthLoginSchema,
  type signupSchema
} from '../validators';

/**
 * Schema extensions for adding custom fields to auth inputs
 */
export interface SchemaExtensions {
  signup?: AnyZodObject;
  login?: AnyZodObject;
  oauth?: AnyZodObject;
}

type BaseSignupInput = z.infer<typeof signupSchema>;
type BaseLoginInput = z.infer<typeof loginSchema>;
type BaseOAuthInput = z.infer<typeof oAuthLoginSchema>;

/** Input types that include base fields plus any extension fields */
type ExtendedSignupInput<TExtensions extends SchemaExtensions> =
  BaseSignupInput & (TExtensions['signup'] extends AnyZodObject ? z.infer<TExtensions['signup']> : Record<string, unknown>);
type ExtendedLoginInput<TExtensions extends SchemaExtensions> =
  BaseLoginInput & (TExtensions['login'] extends AnyZodObject ? z.infer<TExtensions['login']> : Record<string, unknown>);
type ExtendedOAuthInput<TExtensions extends SchemaExtensions> =
  BaseOAuthInput & (TExtensions['oauth'] extends AnyZodObject ? z.infer<TExtensions['oauth']> : Record<string, unknown>);

/**
 * Lifecycle hooks for extending auth behavior with business logic
 * @template TExtensions - Schema extensions to merge with base input types
 */
export interface AuthHooks<TExtensions extends SchemaExtensions = {}> {
  /**
   * Called before user registration validation
   * Use this to add custom validation or check business rules
   */
  beforeRegister?: (
    input: ExtendedSignupInput<TExtensions>
  ) => Promise<void>;

  /**
   * Called before user login validation
   * Use this to add custom validation or check business rules
   */
  beforeLogin?: (
    input: ExtendedLoginInput<TExtensions>
  ) => Promise<void>;

  /**
   * Called after a new user is created
   * Use this to set up user preferences, default data, etc.
   */
  onUserCreated?: (
    userId: number,
    input: ExtendedSignupInput<TExtensions> | ExtendedOAuthInput<TExtensions>
  ) => Promise<void>;

  /**
   * Called after successful login
   * Use this to update activity status, send notifications, etc.
   */
  onUserLogin?: (userId: number, sessionId: number) => Promise<void>;

  /**
   * Called to get additional data for session creation
   * Return an object with extra fields to include in session.create
   */
  getSessionData?: (
    input:
      | ExtendedSignupInput<TExtensions>
      | ExtendedLoginInput<TExtensions>
      | ExtendedOAuthInput<TExtensions>
  ) => Promise<Record<string, unknown>>;

  /**
   * Called after a new session is created
   */
  onSessionCreated?: (
    sessionId: number,
    input:
      | ExtendedSignupInput<TExtensions>
      | ExtendedLoginInput<TExtensions>
      | ExtendedOAuthInput<TExtensions>
  ) => Promise<void>;

  /**
   * Called when a session is revoked
   */
  onSessionRevoked?: (
    sessionId: number,
    socketId: string | null,
    reason: string
  ) => Promise<void>;

  /**
   * Called after user logs out
   */
  afterLogout?: (
    userId: number,
    sessionId: number,
    socketId: string | null
  ) => Promise<void>;

  /**
   * Called on token refresh
   */
  onRefresh?: (userId: number) => Promise<void>;

  /**
   * Called after password is changed
   */
  onPasswordChanged?: (userId: number) => Promise<void>;

  /**
   * Called after email is verified
   */
  onEmailVerified?: (userId: number) => Promise<void>;

  /**
   * Called after 2FA is enabled/disabled
   */
  onTwoFaStatusChanged?: (userId: number, enabled: boolean) => Promise<void>;

  /**
   * Called after OAuth account is linked
   */
  onOAuthLinked?: (
    userId: number,
    provider: 'GOOGLE' | 'APPLE'
  ) => Promise<void>;

  /**
   * Custom validation for biometric verification
   * Return timeout in ms, or null to skip timeout enforcement
   */
  getBiometricTimeout?: () => Promise<number | null>;

  /**
   * Called after biometric verification
   */
  onBiometricVerified?: (userId: number) => Promise<void>;

  /**
   * Called to log errors (e.g., server errors, auth errors)
   * Provides a hook for centralized error logging
   * Returns error ID for linking purposes
   */
  logError?: (params: {
    type: 'SERVER_ERROR' | 'DATABASE_ERROR' | 'SECURITY' | 'OTHER';
    description: string;
    stack: string;
    ip?: string;
    userId?: number | null;
  }) => Promise<{ errorId: number; stackId: number } | null>;
}
