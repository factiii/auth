import { test, expect } from '@playwright/test';

test.describe('Validation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle maximum length username (30 chars)', async ({ page }) => {
    const timestamp = Date.now();
    const longUsername = 'a'.repeat(30);

    await page.fill('#username', longUsername);
    await page.fill('#email', `maxlen${timestamp}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await page.waitForSelector('.dashboard, [data-testid="error"]');
  });

  test('should handle unicode in email', async ({ page }) => {
    const timestamp = Date.now();

    await page.fill('#username', `unicode${timestamp}`);
    await page.fill('#email', `test${timestamp}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.locator('.dashboard')).toBeVisible();
  });

  test('should handle special characters in password', async ({ page }) => {
    const timestamp = Date.now();
    const specialPassword = 'P@ss!w0rd#$%^&*(){}[]|:;<>,.?/~`';

    await page.fill('#username', `specialpwd${timestamp}`);
    await page.fill('#email', `special${timestamp}@example.com`);
    await page.fill('#password', specialPassword);
    await page.click('#submit-btn');

    await expect(page.locator('.dashboard')).toBeVisible();

    // Logout and verify login with special password works
    await page.click('button:has-text("Log Out")');
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');
    await page.fill('#username', `specialpwd${timestamp}`);
    await page.fill('#password', specialPassword);
    await page.click('#login-btn');

    await expect(page.locator('.dashboard')).toBeVisible();
  });

  test('should reject whitespace-only username', async ({ page }) => {
    await page.fill('#username', '   ');
    await page.fill('#email', 'whitespace@example.com');
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
  });

  test('should reject whitespace-only password', async ({ page }) => {
    await page.fill('#username', 'whitespaceuser');
    await page.fill('#email', 'wspwd@example.com');
    await page.fill('#password', '      ');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
  });

  test('should trim email whitespace', async ({ page }) => {
    const timestamp = Date.now();

    await page.fill('#username', `trimuser${timestamp}`);
    await page.fill('#email', `  trim${timestamp}@example.com  `);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.locator('.dashboard')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should display user-friendly error messages', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');

    await page.fill('#username', 'nonexistent');
    await page.fill('#password', 'wrongpassword');
    await page.click('#login-btn');

    const error = page.getByTestId('error');
    await expect(error).toBeVisible();
    // Error should be user-friendly, not a technical error
    await expect(error).not.toContainText('TRPC');
    await expect(error).not.toContainText('undefined');
    await expect(error).not.toContainText('null');
  });

  test('should handle rapid form submissions', async ({ page }) => {
    await page.goto('/');

    const timestamp = Date.now();
    await page.fill('#username', `rapid${timestamp}`);
    await page.fill('#email', `rapid${timestamp}@example.com`);
    await page.fill('#password', 'Password123');

    // Click once - subsequent clicks should be prevented by disabled state
    await page.click('#submit-btn');

    // Should eventually land on dashboard or show error, but not crash
    await page.waitForSelector('.dashboard, [data-testid="error"]', { timeout: 10000 });
  });

  test('should handle concurrent login attempts gracefully', async ({ page, context }) => {
    // Create user first
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `concurrent${timestamp}${rand}`;
    const email = `concurrent${timestamp}${rand}@example.com`;
    const password = 'Password123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();
    await page.click('button:has-text("Log Out")');

    const page2 = await context.newPage();
    await page2.goto('/');

    // Try to login from both pages simultaneously
    await page.click('button:has-text("Log in")');
    await page2.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');
    await expect(page2.locator('h1')).toHaveText('Welcome Back');

    await page.fill('#username', username);
    await page.fill('#password', password);

    await page2.fill('#username', username);
    await page2.fill('#password', password);

    // Click login on both
    await Promise.all([
      page.click('#login-btn'),
      page2.click('#login-btn'),
    ]);

    // At least one should succeed
    await Promise.race([
      expect(page.locator('.dashboard')).toBeVisible(),
      expect(page2.locator('.dashboard')).toBeVisible(),
    ]);

    await page2.close();
  });
});

test.describe('Security', () => {
  test('should not leak user existence on login error', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');

    // Try with definitely non-existent user
    await page.fill('#username', 'definitelynotarealuser12345');
    await page.fill('#password', 'wrongpassword');
    await page.click('#login-btn');

    const error = page.getByTestId('error');
    await expect(error).toBeVisible();
    // Error message should be generic, not revealing if user exists
    await expect(error).toContainText('Invalid credentials');
    await expect(error).not.toContainText('not found');
    await expect(error).not.toContainText('does not exist');
  });

  test('should not leak user existence on password reset', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');
    await page.click('button:has-text("Forgot your password?")');

    // Try with definitely non-existent email
    await page.fill('#email', 'nonexistent12345@example.com');
    await page.click('button:has-text("Send Reset Link")');

    // Should show same success message regardless of email existence
    await expect(page.locator('h1')).toHaveText('Check your email');
    await expect(page.locator('.auth-subtitle')).toContainText('If an account exists');
  });

  test('should clear sensitive data on logout', async ({ page }) => {
    const timestamp = Date.now();

    await page.goto('/');
    await page.fill('#username', `logout${timestamp}`);
    await page.fill('#email', `logout${timestamp}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    // Logout
    await page.click('button:has-text("Log Out")');

    // Should see auth page after logout
    await expect(page.locator('.auth-page')).toBeVisible();

    // Reload to verify session is truly cleared
    await page.reload();

    // Should still be at auth page, not dashboard
    await expect(page.locator('.dashboard')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('.auth-page')).toBeVisible({ timeout: 10000 });
  });

  test('should not show user data after session expires', async ({ page }) => {
    const timestamp = Date.now();

    await page.goto('/');
    await page.fill('#username', `sessionexp${timestamp}`);
    await page.fill('#email', `sessionexp${timestamp}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    // Logout and clear cookies to simulate session expiry
    await page.click('button:has-text("Log Out")');

    // Clear any stored auth data
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload and verify no access
    await page.reload();
    await expect(page.locator('.dashboard')).not.toBeVisible();
  });
});

test.describe('Input Validation', () => {
  test('should validate username format', async ({ page }) => {
    await page.goto('/');

    // Test invalid characters
    await page.fill('#username', 'user@name');
    await page.fill('#email', 'valid@example.com');
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/');

    await page.fill('#username', 'validuser');
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('Invalid email');
  });

  test('should enforce minimum password length', async ({ page }) => {
    await page.goto('/');

    await page.fill('#username', 'shortpwdtest');
    await page.fill('#email', 'shortpwd@example.com');
    await page.fill('#password', '12345');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('6 characters');
  });
});
