import bcrypt from 'bcryptjs';

/**
 * Default salt rounds for password hashing
 */
const DEFAULT_SALT_ROUNDS = 10;

/**
 * Hash a plain text password
 * @param password - Plain text password
 * @param saltRounds - Number of salt rounds (default: 10)
 * @returns Hashed password
 */
export async function hashPassword(
  password: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<string> {
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns True if passwords match
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Check if a password meets minimum requirements
 * @param password - Password to validate
 * @param minLength - Minimum length (default: 6)
 * @returns Validation result with error message if invalid
 */
export function validatePasswordStrength(
  password: string,
  minLength = 6
): { valid: boolean; error?: string } {
  if (password.length < minLength) {
    return {
      valid: false,
      error: `Password must be at least ${minLength} characters`,
    };
  }
  return { valid: true };
}
