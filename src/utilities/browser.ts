/**
 * Detect browser/platform from user agent string
 * @param userAgent - User agent string from request headers
 * @returns Detected browser name
 */
export function detectBrowser(userAgent: string): string {
  // Check if it's an iOS app by looking for specific app-related terms
  if (/cfnetwork|darwin/i.test(userAgent)) return 'iOS App';

  // Check for iOS browsers
  if (
    /iphone|ipad|ipod/i.test(userAgent) &&
    /safari/i.test(userAgent) &&
    !/crios|fxios|edg\//i.test(userAgent)
  ) {
    return 'iOS Browser (Safari)';
  }
  if (/iphone|ipad|ipod/i.test(userAgent) && /crios/i.test(userAgent))
    return 'iOS Browser (Chrome)';
  if (/iphone|ipad|ipod/i.test(userAgent) && /fxios/i.test(userAgent))
    return 'iOS Browser (Firefox)';
  if (/iphone|ipad|ipod/i.test(userAgent) && /edg\//i.test(userAgent))
    return 'iOS Browser (Edge)';

  // Check if it's an Android app
  if (
    /android/i.test(userAgent) &&
    !/chrome|firefox|samsungbrowser|opr\/|edg\//i.test(userAgent)
  ) {
    return 'Android App';
  }

  // Check for Android browsers
  if (/android/i.test(userAgent) && /chrome/i.test(userAgent))
    return 'Android Browser (Chrome)';
  if (/android/i.test(userAgent) && /firefox/i.test(userAgent))
    return 'Android Browser (Firefox)';
  if (/android/i.test(userAgent) && /samsungbrowser/i.test(userAgent))
    return 'Android Browser (Samsung)';
  if (/android/i.test(userAgent) && /opr\//i.test(userAgent))
    return 'Android Browser (Opera)';
  if (/android/i.test(userAgent) && /edg\//i.test(userAgent))
    return 'Android Browser (Edge)';

  // Check for common desktop browsers
  if (/chrome|chromium/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome|chromium|crios/i.test(userAgent))
    return 'Safari';
  if (/opr\//i.test(userAgent)) return 'Opera';
  if (/edg\//i.test(userAgent)) return 'Edge';

  return 'Unknown';
}

/**
 * Check if the user agent indicates a mobile device
 * @param userAgent - User agent string
 * @returns True if mobile device
 */
export function isMobileDevice(userAgent: string): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

/**
 * Check if the user agent indicates a native app
 * @param userAgent - User agent string
 * @returns True if native app
 */
export function isNativeApp(userAgent: string): boolean {
  const browser = detectBrowser(userAgent);
  return browser === 'iOS App' || browser === 'Android App';
}
