import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';

import { type CookieSettings } from '../types';

/**
 * Default storage key for auth cookie
 */
export const DEFAULT_STORAGE_KEYS = {
  AUTH_TOKEN: 'auth-token',
};

/**
 * Parse auth token from cookie header
 * @param cookieHeader - Raw cookie header string
 * @param storageKeys - Custom storage keys (optional)
 * @returns Parsed auth token
 */
export function parseAuthCookie(
  cookieHeader: string | undefined,
  storageKeys: { authToken: string } = {
    authToken: DEFAULT_STORAGE_KEYS.AUTH_TOKEN,
  }
): { authToken?: string } {
  if (!cookieHeader) {
    return {};
  }
  const authToken = cookieHeader.split(`${storageKeys.authToken}=`)[1]?.split(';')[0];

  return {
    authToken: authToken || undefined,
  };
}

/**
 * Extract domain from request headers
 * Tries origin header first (for POST/PUT/DELETE), then referer (for GET), then host
 * @param req - HTTP request object
 * @returns Domain hostname or undefined
 */
function extractDomain(req: CreateHTTPContextOptions['res']['req']): string | undefined {
  // Try origin header first (available for POST/PUT/DELETE requests)
  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      // Invalid URL, continue to next option
    }
  }

  // Try referer header (available for GET requests)
  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      // Invalid URL, continue to next option
    }
  }

  // Fall back to host header (always available, but may include port)
  const host = req.headers.host;
  if (host) {
    // Remove port if present (e.g., "example.com:3000" -> "example.com")
    return host.split(':')[0];
  }

  return undefined;
}

/**
 * Set auth cookie on response
 * @param res - HTTP response object
 * @param authToken - Auth JWT token
 * @param settings - Cookie settings
 * @param storageKeys - Storage key names
 */
export function setAuthCookie(
  res: CreateHTTPContextOptions['res'],
  authToken: string,
  settings: Partial<CookieSettings>,
  storageKeys: { authToken: string } = {
    authToken: DEFAULT_STORAGE_KEYS.AUTH_TOKEN,
  }
): void {
  const domain = settings.domain ?? extractDomain(res.req);

  const expiresDate = settings.maxAge
    ? new Date(Date.now() + settings.maxAge * 1000).toUTCString()
    : undefined;

  const cookie = [
    `${storageKeys.authToken}=${authToken}`,
    settings.httpOnly ? 'HttpOnly' : '',
    settings.secure ? 'Secure=true' : '',
    `SameSite=${settings.sameSite}`,
    `Path=${settings.path ?? '/'}`,
    domain ? `Domain=${domain}` : '',
    expiresDate ? `Expires=${expiresDate}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}

/**
 * Clear auth cookie (for logout)
 * @param res - HTTP response object
 * @param settings - Cookie settings
 * @param storageKeys - Storage key names
 */
export function clearAuthCookie(
  res: CreateHTTPContextOptions['res'],
  settings: Partial<CookieSettings>,
  storageKeys: { authToken: string } = {
    authToken: DEFAULT_STORAGE_KEYS.AUTH_TOKEN,
  }
): void {
  const domain = extractDomain(res.req);
  const expiredDate = new Date(0).toUTCString();

  const cookie = [
    `${storageKeys.authToken}=destroy`,
    settings.httpOnly ? 'HttpOnly' : '',
    settings.secure ? 'Secure=true' : '',
    `SameSite=${settings.sameSite}`,
    `Path=${settings.path ?? '/'}`,
    domain ? `Domain=${domain}` : '',
    `Expires=${expiredDate}`,
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}
