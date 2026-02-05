import { test, expect } from '@playwright/test';

test.describe('Signup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display signup form', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Create Account');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#submit-btn')).toBeVisible();
  });

  test('should successfully create a new account and navigate to dashboard', async ({ page }) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `testuser${timestamp}${rand}`;
    const email = `test${timestamp}${rand}@example.com`;

    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    // Should navigate to dashboard after successful signup
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
  });

  test('should show error for duplicate username', async ({ page }) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `dupuser${timestamp}${rand}`;

    // First signup
    await page.fill('#username', username);
    await page.fill('#email', `first${timestamp}${rand}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    // Wait for dashboard and logout
    await expect(page.locator('.dashboard')).toBeVisible();
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h1')).toHaveText('Create Account');

    // Try to sign up with same username
    await page.fill('#username', username);
    await page.fill('#email', `second${timestamp}${rand}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('already exists with that username');
  });

  test('should show error for duplicate email', async ({ page }) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const email = `dupemail${timestamp}${rand}@example.com`;

    // First signup
    await page.fill('#username', `first${timestamp}${rand}`);
    await page.fill('#email', email);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    // Wait for dashboard and logout
    await expect(page.locator('.dashboard')).toBeVisible();
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h1')).toHaveText('Create Account');

    // Try to sign up with same email
    await page.fill('#username', `second${timestamp}${rand}`);
    await page.fill('#email', email);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('already exists with that email');
  });

  test('should validate password minimum length', async ({ page }) => {
    await page.fill('#username', 'shortpwduser');
    await page.fill('#email', 'shortpwd@example.com');
    await page.fill('#password', '123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('at least 6 characters');
  });

  test('should validate username format', async ({ page }) => {
    await page.fill('#username', 'invalid user!');
    await page.fill('#email', 'validusername@example.com');
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('letters, numbers, and underscores');
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('#username', 'validuser');
    await page.fill('#email', 'not-an-email');
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('Invalid email');
  });

  test('should disable submit button while loading', async ({ page }) => {
    const timestamp = Date.now();

    await page.fill('#username', `loaduser${timestamp}`);
    await page.fill('#email', `load${timestamp}@example.com`);
    await page.fill('#password', 'Password123');

    const submitBtn = page.locator('#submit-btn');
    await submitBtn.click();

    // Button should show loading state during submission
    await expect(submitBtn).toHaveText('Creating account...');
  });
});

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should switch between signup and login forms', async ({ page }) => {
    // Start on signup
    await expect(page.locator('h1')).toHaveText('Create Account');

    // Switch to login
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');

    // Switch back to signup
    await page.click('button:has-text("Sign up")');
    await expect(page.locator('h1')).toHaveText('Create Account');
  });

  test('should login with valid credentials', async ({ page }) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `loginuser${timestamp}${rand}`;
    const email = `login${timestamp}${rand}@example.com`;
    const password = 'Password123';

    // First, create an account
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');

    // Wait for dashboard and logout
    await expect(page.locator('.dashboard')).toBeVisible();
    await page.click('button:has-text("Log Out")');

    // Switch to login
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');

    // Login
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#login-btn');

    // Should be on dashboard
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Switch to login
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');

    await page.fill('#username', 'nonexistentuser');
    await page.fill('#password', 'wrongpassword');
    await page.click('#login-btn');

    await expect(page.getByTestId('error')).toBeVisible();
    await expect(page.getByTestId('error')).toContainText('Invalid credentials');
  });
});

test.describe('Dashboard', () => {
  test('should display user info and allow logout', async ({ page }) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `dashuser${timestamp}${rand}`;
    const email = `dash${timestamp}${rand}@example.com`;

    await page.goto('/');

    // Create account
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    // Verify dashboard
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    await expect(page.locator('.welcome-card .email')).toContainText(email);

    // Logout
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h1')).toHaveText('Create Account');
  });

  test('should toggle settings panel', async ({ page }) => {
    const timestamp = Date.now();

    await page.goto('/');

    // Create account
    await page.fill('#username', `settingsuser${timestamp}`);
    await page.fill('#email', `settings${timestamp}@example.com`);
    await page.fill('#password', 'Password123');
    await page.click('#submit-btn');

    // Wait for dashboard
    await expect(page.locator('.dashboard')).toBeVisible();

    // Settings panel should not be visible initially
    await expect(page.locator('.settings-panel')).not.toBeVisible();

    // Click settings button to open panel
    await page.click('button[aria-label="Settings"]');
    await expect(page.locator('.settings-panel')).toBeVisible();
    await expect(page.locator('.settings-panel h3')).toHaveText('Account Settings');

    // Click again to close
    await page.click('button[aria-label="Settings"]');
    await expect(page.locator('.settings-panel')).not.toBeVisible();
  });
});
