import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to login page
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');
  });

  test.describe('Form Display', () => {
    test('should display login form with all elements', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('Welcome Back');
      await expect(page.locator('.auth-subtitle')).toHaveText('Log in to your account');
      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#login-btn')).toBeVisible();
      await expect(page.locator('button:has-text("Forgot your password?")')).toBeVisible();
      await expect(page.locator('button:has-text("Sign up")')).toBeVisible();
    });

    test('should have correct input labels and placeholders', async ({ page }) => {
      await expect(page.locator('label[for="username"]')).toHaveText('Username or Email');
      await expect(page.locator('label[for="password"]')).toHaveText('Password');
      await expect(page.locator('#username')).toHaveAttribute('placeholder', 'Enter username or email');
      await expect(page.locator('#password')).toHaveAttribute('placeholder', 'Enter your password');
    });
  });

  test.describe('Happy Paths', () => {
    test('should login with username', async ({ page }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `loginusr${timestamp}`.slice(0, 24) + rand;
      const email = `loginuser${timestamp}${rand}@example.com`;
      const password = 'Password123';

      // First create an account
      await page.click('button:has-text("Sign up")');
      await expect(page.locator('h1')).toHaveText('Create Account');
      await page.fill('#username', username);
      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('#submit-btn');
      await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10000 });
      await page.click('button:has-text("Log Out")');

      // Go to login page
      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');

      // Login with username
      await page.fill('#username', username);
      await page.fill('#password', password);
      await page.click('#login-btn');

      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    });

    test('should login with email instead of username', async ({ page }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `emaillogin${timestamp}${rand}`;
      const email = `emaillogin${timestamp}${rand}@example.com`;
      const password = 'Password123';

      // First create an account
      await page.click('button:has-text("Sign up")');
      await expect(page.locator('h1')).toHaveText('Create Account');
      await page.fill('#username', username);
      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('#submit-btn');
      await expect(page.locator('.dashboard')).toBeVisible();
      await page.click('button:has-text("Log Out")');

      // Go to login page
      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');

      // Login with email instead of username
      await page.fill('#username', email);
      await page.fill('#password', password);
      await page.click('#login-btn');

      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    });

    test('should persist session after page reload', async ({ page }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `persistuser${timestamp}${rand}`;
      const email = `persist${timestamp}${rand}@example.com`;
      const password = 'Password123';

      // Create account and login
      await page.click('button:has-text("Sign up")');
      await expect(page.locator('h1')).toHaveText('Create Account');
      await page.fill('#username', username);
      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('#submit-btn');
      await expect(page.locator('.dashboard')).toBeVisible();

      // Reload the page
      await page.reload();

      // Should still be on dashboard after reload (session persisted)
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    });
  });

  test.describe('Validation', () => {
    test('should show error for empty fields', async ({ page }) => {
      // Try to login without entering anything
      await page.click('#login-btn');

      await expect(page.getByTestId('error')).toBeVisible();
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.fill('#username', 'nonexistentuser12345');
      await page.fill('#password', 'somepassword');
      await page.click('#login-btn');

      await expect(page.getByTestId('error')).toBeVisible();
      await expect(page.getByTestId('error')).toContainText('Invalid credentials');
    });

    test('should show error for wrong password', async ({ page }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `wrongpwd${timestamp}${rand}`;
      const email = `wrongpwd${timestamp}${rand}@example.com`;

      // First create an account
      await page.click('button:has-text("Sign up")');
      await expect(page.locator('h1')).toHaveText('Create Account');
      await page.fill('#username', username);
      await page.fill('#email', email);
      await page.fill('#password', 'CorrectPassword123');
      await page.click('#submit-btn');
      await expect(page.locator('.dashboard')).toBeVisible();
      await page.click('button:has-text("Log Out")');

      // Go to login page
      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');

      // Try to login with wrong password
      await page.fill('#username', username);
      await page.fill('#password', 'WrongPassword456');
      await page.click('#login-btn');

      await expect(page.getByTestId('error')).toBeVisible();
      await expect(page.getByTestId('error')).toContainText('Invalid credentials');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      await page.click('button:has-text("Forgot your password?")');
      await expect(page.locator('h1')).toHaveText('Reset Password');
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.click('button:has-text("Sign up")');
      await expect(page.locator('h1')).toHaveText('Create Account');
    });
  });
});
