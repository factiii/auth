import { z, type AnyZodObject } from 'zod';

import type { SchemaExtensions } from './types/hooks';

/**
 * Username validation regex - allows letters, numbers, and underscores
 */
const usernameValidationRegex = /^[a-zA-Z0-9_]+$/;

/**
 * Schema for user registration
 */
export const signupSchema = z.object({
  username: z
    .string()
    .min(1, { message: 'Username is required' })
    .max(30, { message: 'Username must be 30 characters or less' })
    .regex(usernameValidationRegex, {
      message: 'Username can only contain letters, numbers, and underscores',
    }),
  email: z
    .string()
    .max(254, { message: 'Email must be 254 characters or less' })
    .email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must contain at least 6 characters' })
    .max(72, { message: 'Password must be 72 characters or less' })
    .refine((val) => val.trim().length >= 6, {
      message: 'Password cannot be only whitespace',
    }),
});

/**
 * Schema for user login
 */
export const loginSchema = z.object({
  username: z.string().min(1, { message: 'Username or email is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
  code: z.string().optional(), // 2FA code
});

/**
 * Schema for OAuth login
 */
export const oAuthLoginSchema = z.object({
  idToken: z.string(),
  user: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
  provider: z.enum(['GOOGLE', 'APPLE']),
});

/**
 * Schema for password reset request
 */
export const requestPasswordResetSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

/**
 * Schema for password reset confirmation
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required' }),
  password: z
    .string()
    .min(6, { message: 'Password must contain at least 6 characters' })
    .max(72, { message: 'Password must be 72 characters or less' }),
});

/**
 * Schema for checking password reset token
 */
export const checkPasswordResetSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required' }),
});

/**
 * Schema for changing password (authenticated)
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword: z
    .string()
    .min(6, { message: 'New password must contain at least 6 characters' })
    .max(72, { message: 'Password must be 72 characters or less' }),
});

/**
 * Schema for 2FA verification
 */
export const twoFaVerifySchema = z.object({
  code: z.string().min(6, { message: 'Verification code is required' }),
  sessionId: z.number().optional(),
});

/**
 * Schema for 2FA setup
 */
export const twoFaSetupSchema = z.object({
  code: z.string().min(6, { message: 'Verification code is required' }),
});

/**
 * Schema for 2FA reset request
 */
export const twoFaResetSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Schema for 2FA reset verification
 */
export const twoFaResetVerifySchema = z.object({
  code: z.number().min(100000).max(999999),
  username: z.string().min(1),
});

/**
 * Schema for email verification
 */
export const verifyEmailSchema = z.object({
  code: z.string().min(1, { message: 'Verification code is required' }),
});

/**
 * Schema for resending verification email
 */
export const resendVerificationSchema = z.object({
  email: z.string().email().optional(),
});

/**
 * Schema for biometric verification
 */
export const biometricVerifySchema = z.object({});

/**
 * Schema for push token registration
 */
export const registerPushTokenSchema = z.object({
  pushToken: z.string().min(1, { message: 'Push token is required' }),
});

/**
 * Schema for push token deregistration
 */
export const deregisterPushTokenSchema = z.object({
  pushToken: z.string().min(1, { message: 'Push token is required' }),
});

/**
 * Schema for getting 2FA secret
 */
export const getTwofaSecretSchema = z.object({
  pushCode: z.string().min(6, { message: 'Push code is required' }),
});

/**
 * Schema for disabling 2FA
 */
export const disableTwofaSchema = z.object({
  password: z.string().min(1, { message: 'Password is required' }),
});

/**
 * Schema for logout
 */
export const logoutSchema = z.object({
  allDevices: z.boolean().optional().default(false),
});

/**
 * Schema for ending all sessions
 */
export const endAllSessionsSchema = z.object({
  skipCurrentSession: z.boolean().optional().default(true),
});

/**
 * Schema for OTP-based login request
 */
export const otpLoginRequestSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

/**
 * Schema for OTP-based login verification
 */
export const otpLoginVerifySchema = z.object({
  email: z.string().email(),
  code: z.number().min(100000).max(999999),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OAuthLoginInput = z.infer<typeof oAuthLoginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TwoFaVerifyInput = z.infer<typeof twoFaVerifySchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;

/** Schemas used by auth procedures */
export interface AuthSchemas {
  signup: AnyZodObject;
  login: AnyZodObject;
  oauth: AnyZodObject;
}

/**
 * Compute merged ZodObject type.
 * When TExt is defined, produces a schema with both base and extension shapes.
 * When TExt is undefined, produces the base schema.
 */
type MergedSchema<TBase extends AnyZodObject, TExt extends AnyZodObject | undefined> = [
  TExt,
] extends [AnyZodObject]
  ? z.ZodObject<TBase['shape'] & TExt['shape'], 'strip', z.ZodTypeAny>
  : TBase;

/** Result type from createSchemas - preserves concrete schema types */
export type CreatedSchemas<TExtensions extends SchemaExtensions = {}> = {
  signup: MergedSchema<typeof signupSchema, TExtensions['signup']>;
  login: MergedSchema<typeof loginSchema, TExtensions['login']>;
  oauth: MergedSchema<typeof oAuthLoginSchema, TExtensions['oauth']>;
};

export type SignupSchemaInput<TExtensions extends SchemaExtensions = {}> = SignupInput &
  (TExtensions['signup'] extends AnyZodObject ? z.infer<TExtensions['signup']> : {});

export type LoginSchemaInput<TExtensions extends SchemaExtensions = {}> = LoginInput &
  (TExtensions['login'] extends AnyZodObject ? z.infer<TExtensions['login']> : {});

export type OAuthSchemaInput<TExtensions extends SchemaExtensions = {}> = OAuthLoginInput &
  (TExtensions['oauth'] extends AnyZodObject ? z.infer<TExtensions['oauth']> : {});

/** Create schemas with optional extensions merged in */
export function createSchemas<TExtensions extends SchemaExtensions = {}>(
  extensions?: TExtensions
): CreatedSchemas<TExtensions> {
  return {
    signup: extensions?.signup ? signupSchema.merge(extensions.signup) : signupSchema,
    login: extensions?.login ? loginSchema.merge(extensions.login) : loginSchema,
    oauth: extensions?.oauth ? oAuthLoginSchema.merge(extensions.oauth) : oAuthLoginSchema,
  } as CreatedSchemas<TExtensions>;
}
