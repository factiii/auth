import { test, expect, type Page } from '@playwright/test';

test.describe('Password Reset - Request', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to login, then forgot password
    await page.click('button:has-text("Log in")');
    await page.click('button:has-text("Forgot your password?")');
    await expect(page.locator('h1')).toHaveText('Reset Password');
  });

  test('should display forgot password form', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Reset Password');
    await expect(page.locator('.auth-subtitle')).toContainText('email');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('button:has-text("Send Reset Link")')).toBeVisible();
    await expect(page.locator('button:has-text("Back to Login")')).toBeVisible();
  });

  test('should show success after submitting email', async ({ page }) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const email = `resetrequest${timestamp}${rand}@example.com`;

    // First create an account with this email
    await page.goto('/');
    await page.fill('#username', `resetreq${timestamp}${rand}`);
    await page.fill('#email', email);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();
    await page.click('button:has-text("Log Out")');

    // Go to forgot password
    await page.click('button:has-text("Log in")');
    await page.click('button:has-text("Forgot your password?")');

    // Submit email
    await page.fill('#email', email);
    await page.click('button:has-text("Send Reset Link")');

    // Should show success message
    await expect(page.locator('h1')).toHaveText('Check your email');
    await expect(page.locator('.auth-subtitle')).toContainText('password reset instructions');
  });

  test('should show success even for non-existent email (security)', async ({ page }) => {
    // Submit email that doesn't exist - should still show success for security
    await page.fill('#email', 'nonexistent@example.com');
    await page.click('button:has-text("Send Reset Link")');

    // Should show the same success message (to prevent email enumeration)
    await expect(page.locator('h1')).toHaveText('Check your email');
    await expect(page.locator('.auth-subtitle')).toContainText('If an account exists');
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('#email', 'not-a-valid-email');
    await page.click('button:has-text("Send Reset Link")');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('Invalid email');
  });

  test('should navigate back to login', async ({ page }) => {
    await page.click('button:has-text("Back to Login")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');
  });

  test('should show loading state while sending', async ({ page }) => {
    await page.fill('#email', 'loading@example.com');

    await page.route('**/api**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const sendBtn = page.locator('form button[type="submit"]');
    await sendBtn.click();
    await expect(sendBtn).toHaveText('Sending...', { timeout: 1000 });
  });
});

test.describe('Password Reset - Complete', () => {
  test('should show error for invalid token', async ({ page }) => {
    // Navigate directly to reset page with invalid token
    await page.goto('/reset-password?token=invalid-token-12345');

    // Wait for validation to complete
    await expect(page.locator('h1')).toHaveText('Invalid Reset Link', { timeout: 10000 });
    await expect(page.locator('.auth-subtitle')).toContainText(/invalid/i);
    await expect(page.locator('button:has-text("Back to Login")')).toBeVisible();
  });

  test('should navigate back to login from invalid token page', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token');

    await expect(page.locator('h1')).toHaveText('Invalid Reset Link');
    await page.click('button:has-text("Back to Login")');

    await expect(page.locator('h1')).toHaveText('Welcome Back');
    expect(page.url()).not.toContain('token=');
  });

  // Helper to create a user and get a valid password reset token
  const getValidResetToken = async (page: Page, timestamp: number) => {
    const rand = Math.random().toString(36).slice(2, 8);
    const email = `pwdreset${timestamp}${rand}@example.com`;

    // Create user
    await page.goto('/');
    await page.fill('#username', `pwdreset${timestamp}${rand}`);
    await page.fill('#email', email);
    await page.fill('#password', 'OldPassword123');
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();
    await page.click('button:has-text("Log Out")');

    // Request password reset
    await page.click('button:has-text("Log in")');
    await page.click('button:has-text("Forgot your password?")');
    await page.fill('#email', email);
    await page.click('button:has-text("Send Reset Link")');
    await expect(page.locator('h1')).toHaveText('Check your email');

    // Get token from test endpoint
    const response = await page.request.get(
      `http://localhost:3457/test/tokens?email=${encodeURIComponent(email)}&type=passwordReset`
    );
    const data = await response.json();
    return { token: data.token, email };
  };

  test('should display reset form elements when token is valid', async ({ page }) => {
    const timestamp = Date.now();
    const { token } = await getValidResetToken(page, timestamp);

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.locator('h1')).toHaveText('Set New Password', { timeout: 10000 });
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('button:has-text("Reset Password")')).toBeVisible();
    await expect(page.locator('.hint')).toContainText('at least 6 characters');
  });

  test('should show error when passwords do not match', async ({ page }) => {
    const timestamp = Date.now();
    const { token } = await getValidResetToken(page, timestamp);

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.locator('h1')).toHaveText('Set New Password', { timeout: 10000 });

    await page.fill('#newPassword', 'Password123');
    await page.fill('#confirmPassword', 'DifferentPassword');
    await page.click('button:has-text("Reset Password")');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('do not match');
  });

  test('should validate password minimum length', async ({ page }) => {
    const timestamp = Date.now();
    const { token } = await getValidResetToken(page, timestamp);

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.locator('h1')).toHaveText('Set New Password', { timeout: 10000 });

    await page.fill('#newPassword', '12345');
    await page.fill('#confirmPassword', '12345');
    await page.click('button:has-text("Reset Password")');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('6 characters');
  });

  test('should successfully reset password and login with new password', async ({ page }) => {
    const timestamp = Date.now();
    const { token, email } = await getValidResetToken(page, timestamp);
    const newPassword = 'NewPassword456';

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.locator('h1')).toHaveText('Set New Password', { timeout: 10000 });

    await page.fill('#newPassword', newPassword);
    await page.fill('#confirmPassword', newPassword);
    await page.click('button:has-text("Reset Password")');

    // Should show success
    await expect(page.locator('h1')).toHaveText('Password Reset Complete', { timeout: 10000 });

    // Login with new password
    await page.click('button:has-text("Go to Login")');
    await page.fill('#username', email);
    await page.fill('#password', newPassword);
    await page.click('#login-btn');

    await expect(page.locator('.dashboard')).toBeVisible();
  });
});
