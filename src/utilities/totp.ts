import crypto from 'crypto';
import { TOTP } from 'totp-generator';

/**
 * Base32 character set for TOTP secret generation
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random TOTP secret
 * @param length - Length of the secret (default: 16)
 * @returns Base32 encoded secret
 */
export function generateTotpSecret(length = 16): string {
  let secret = '';
  for (let i = 0; i < length; i++) {
    const randIndex = Math.floor(Math.random() * BASE32_CHARS.length);
    secret += BASE32_CHARS[randIndex];
  }
  return secret;
}

/**
 * Clean a Base32 string by removing invalid characters
 * @param input - Input string to clean
 * @returns Cleaned Base32 string
 */
export function cleanBase32String(input: string): string {
  return input.replace(/[^A-Z2-7]/gi, '').toUpperCase();
}

/**
 * Generate a TOTP code from a secret
 * @param secret - Base32 encoded secret
 * @returns Current TOTP code
 */
export async function generateTotpCode(secret: string) {
  const cleanSecret = cleanBase32String(secret);
  const { otp } = await TOTP.generate(cleanSecret);
  return otp;
}

/**
 * Verify a TOTP code against a secret
 * @param code - TOTP code to verify
 * @param secret - Base32 encoded secret
 * @param window - Number of time steps to check before/after current (default: 1)
 * @returns True if code is valid
 */
export async function verifyTotp(code: string, secret: string) {
  const cleanSecret = cleanBase32String(secret);
  const normalizedCode = code.replace(/\s/g, '');
  const { otp } = await TOTP.generate(cleanSecret);
  return otp === normalizedCode;
}

/**
 * Generate a random OTP code (for email-based verification)
 * @param min - Minimum value (default: 100000)
 * @param max - Maximum value (default: 999999)
 * @returns Random 6-digit OTP
 */
export function generateOtp(min = 100000, max = 999999): number {
  return Math.floor(crypto.randomInt(min, max + 1));
}
