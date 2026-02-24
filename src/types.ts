/**
 * OAuth providers supported by the auth system
 */
export type OAuthProvider = 'GOOGLE' | 'APPLE';

/**
 * JWT payload structure
 */
export interface JwtPayload {
  id: number; // Session ID
  userId: number;
  verifiedHumanAt: Date | null;
  exp?: number;
  iat?: number;
}

/**
 * Cookie settings for auth tokens
 */
export interface CookieSettings {
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  domain?: string;
  httpOnly: boolean;
  path: string;
  maxAge: number; // in seconds
}

