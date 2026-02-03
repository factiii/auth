import jwt, { type SignOptions } from 'jsonwebtoken';

import type { JwtPayload } from '../types';

/**
 * Options for creating access tokens
 */
export interface CreateTokenOptions {
  secret: string;
  expiresIn: SignOptions['expiresIn'];
}

/**
 * Options for verifying access tokens
 */
export interface VerifyTokenOptions {
  secret: string;
  ignoreExpiration?: boolean;
}

/**
 * Create a JWT access token
 * @param payload - Token payload containing session and user info
 * @param options - Token creation options
 * @returns Signed JWT token
 */
export function createAccessToken(
  payload: Omit<JwtPayload, 'exp' | 'iat'>,
  options: CreateTokenOptions
): string {
  return jwt.sign(payload, options.secret, {
    expiresIn: options.expiresIn
  });
}

/**
 * Verify and decode a JWT access token
 * @param token - JWT token to verify
 * @param options - Verification options
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function verifyAccessToken(
  token: string,
  options: VerifyTokenOptions
): JwtPayload {
  return jwt.verify(token, options.secret, {
    ignoreExpiration: options.ignoreExpiration ?? false
  }) as JwtPayload;
}

/**
 * Decode a JWT token without verification
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}

/**
 * JWT error interface
 */
interface JwtError extends Error {
  name: 'TokenExpiredError' | 'JsonWebTokenError' | 'NotBeforeError';
}

/**
 * Check if an error is a JWT error
 */
function isJwtError(error: unknown): error is JwtError {
  return (
    error instanceof Error &&
    ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(
      error.name
    )
  );
}

/**
 * Check if a token error is an expiration error
 */
export function isTokenExpiredError(error: unknown): boolean {
  return isJwtError(error) && error.name === 'TokenExpiredError';
}

/**
 * Check if a token error is a validation error
 */
export function isTokenInvalidError(error: unknown): boolean {
  return isJwtError(error) && error.name === 'JsonWebTokenError';
}
