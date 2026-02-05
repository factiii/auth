import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';

import { type AuthCredentials, type CookieSettings } from '../types';

/**
 * Default storage keys for auth cookies
 */
export const DEFAULT_STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth-at',
  REFRESH_TOKEN: 'auth-rt',
};

/**
 * Parse auth tokens from cookie header
 * @param cookieHeader - Raw cookie header string
 * @param storageKeys - Custom storage keys (optional)
 * @returns Parsed tokens
 */
export function parseAuthCookies(
  cookieHeader: string | undefined,
  storageKeys: { accessToken: string; refreshToken: string } = {
    accessToken: DEFAULT_STORAGE_KEYS.ACCESS_TOKEN,
    refreshToken: DEFAULT_STORAGE_KEYS.REFRESH_TOKEN,
  }
): { accessToken?: string; refreshToken?: string } {
  if (!cookieHeader) {
    return {};
  }
  const accessToken = cookieHeader.split(`${storageKeys.accessToken}=`)[1]?.split(';')[0];
  const refreshToken = cookieHeader.split(`${storageKeys.refreshToken}=`)[1]?.split(';')[0];

  return {
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
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
 * Set auth cookies on response
 * @param res - HTTP response object
 * @param credentials - Access and refresh tokens
 * @param settings - Cookie settings
 * @param storageKeys - Storage key names
 */
export function setAuthCookies(
  res: CreateHTTPContextOptions['res'],
  credentials: Partial<AuthCredentials>,
  settings: Partial<CookieSettings>,
  storageKeys: { accessToken: string; refreshToken: string } = {
    accessToken: DEFAULT_STORAGE_KEYS.ACCESS_TOKEN,
    refreshToken: DEFAULT_STORAGE_KEYS.REFRESH_TOKEN,
  }
): void {
  const cookies: string[] = [];
  const domain = settings.domain ?? extractDomain(res.req);

  const expiresDate = settings.maxAge
    ? new Date(Date.now() + settings.maxAge * 1000).toUTCString()
    : undefined;

  if (credentials.refreshToken) {
    const refreshCookie = [
      `${storageKeys.refreshToken}=${credentials.refreshToken}`,
      'HttpOnly',
      settings.secure ? 'Secure=true' : '',
      `SameSite=${settings.sameSite}`,
      `Path=${settings.refreshTokenPath}`,
      domain ? `Domain=${domain}` : '',
      `Expires=${expiresDate}`,
    ]
      .filter(Boolean)
      .join('; ');

    cookies.push(refreshCookie);
  }

  if (credentials.accessToken) {
    const accessCookie = [
      `${storageKeys.accessToken}=${credentials.accessToken}`,
      settings.secure ? 'Secure=true' : '',
      `SameSite=${settings.sameSite}`,
      `Path=${settings.accessTokenPath}`,
      domain ? `Domain=${domain}` : '',
      `Expires=${expiresDate}`,
    ]
      .filter(Boolean)
      .join('; ');

    cookies.push(accessCookie);
  }

  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }
}

/**
 * Clear auth cookies (for logout)
 * @param res - HTTP response object
 * @param settings - Cookie settings
 * @param storageKeys - Storage key names
 */
export function clearAuthCookies(
  res: CreateHTTPContextOptions['res'],
  settings: Partial<CookieSettings>,
  storageKeys: { accessToken: string; refreshToken: string } = {
    accessToken: DEFAULT_STORAGE_KEYS.ACCESS_TOKEN,
    refreshToken: DEFAULT_STORAGE_KEYS.REFRESH_TOKEN,
  }
): void {
  const domain = extractDomain(res.req);
  const expiredDate = new Date(0).toUTCString();

  const cookies = [
    [
      `${storageKeys.refreshToken}=destroy`,
      'HttpOnly',
      settings.secure ? 'Secure=true' : '',
      `SameSite=${settings.sameSite}`,
      `Path=${settings.refreshTokenPath}`,
      domain ? `Domain=${domain}` : '',
      `Expires=${expiredDate}`,
    ]
      .filter(Boolean)
      .join('; '),
    [
      `${storageKeys.accessToken}=destroy`,
      settings.secure ? 'Secure=true' : '',
      `SameSite=${settings.sameSite}`,
      `Path=${settings.accessTokenPath}`,
      domain ? `Domain=${domain}` : '',
      `Expires=${expiredDate}`,
    ]
      .filter(Boolean)
      .join('; '),
  ];

  res.setHeader('Set-Cookie', cookies);
}
