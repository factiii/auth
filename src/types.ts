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
 * Credentials returned after successful authentication
 */
export interface AuthCredentials {
  accessToken: string;
  refreshToken: string;
}
/**
 * Device information for session tracking
 */
export interface DeviceInfo {
  id?: number;
  pushToken?: string;
}

/**
 * Browser detection result
 */
export type BrowserName =
  | 'Chrome'
  | 'Firefox'
  | 'Safari'
  | 'Edge'
  | 'Opera'
  | 'Mobile App'
  | 'Unknown';

/**
 * Cookie settings for auth tokens
 */
export interface CookieSettings {
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  domain?: string;
  httpOnly: boolean;
  accessTokenPath: string;
  refreshTokenPath: string;
  maxAge: number; // in seconds
}

/**
 * JWT error type
 */
export interface JwtError extends Error {
  name: 'TokenExpiredError' | 'JsonWebTokenError' | 'NotBeforeError';
}

/**
 * Check if an error is a JWT error
 */
export function isJwtError(error: unknown): error is JwtError {
  return (
    error instanceof Error &&
    ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(
      error.name
    )
  );
}
