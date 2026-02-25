import { test, expect, type Page } from '@playwright/test';
import { TOTP } from 'totp-generator';

test.describe('Two-Factor Authentication', () => {
  const createUserAndLogin = async (page: Page, timestamp: number) => {
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `twofa${timestamp}${rand}`;
    const email = `twofa${timestamp}${rand}@example.com`;
    const password = 'TwoFaPwd123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    return { username, email, password };
  };

  test.describe('Setup', () => {
    test('should display 2FA setup option in settings', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');
      await expect(page.locator('.settings-panel')).toBeVisible();

      // Verify 2FA section exists
      await expect(page.getByTestId('twofa-section')).toBeVisible();
      await expect(page.locator('.twofa-section h4')).toHaveText('Two-Factor Authentication');
      await expect(page.getByTestId('enable-2fa-btn')).toBeVisible();
    });

    test('should enable 2FA and show secret', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Enable 2FA
      await page.getByTestId('enable-2fa-btn').click();

      // Should show success message and secret
      await expect(page.getByTestId('settings-message')).toContainText('2FA has been enabled');
      await expect(page.getByTestId('twofa-secret')).toBeVisible();
    });

    test('should show enabled status after enabling 2FA', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings and enable 2FA
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();

      // Should show enabled status
      await expect(page.locator('.status-enabled')).toHaveText('Enabled');
    });

    test('should show disable 2FA option after enabling', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings and enable 2FA
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();

      // Should show disable button
      await expect(page.getByTestId('show-disable-2fa-btn')).toBeVisible();
    });

    test('should require password to disable 2FA', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings and enable 2FA
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();
      await expect(page.getByTestId('twofa-secret')).toBeVisible();

      // Click disable
      await page.getByTestId('show-disable-2fa-btn').click();

      // Should show password input
      await expect(page.locator('#twoFaPassword')).toBeVisible();
      await expect(page.getByTestId('confirm-disable-2fa-btn')).toBeVisible();
    });
  });

  test.describe('Login with 2FA', () => {
    test('should show 2FA code input when required', async ({ page }) => {
      const timestamp = Date.now();
      const { username, password } = await createUserAndLogin(page, timestamp);

      // Enable 2FA
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();
      await expect(page.getByTestId('twofa-secret')).toBeVisible();

      // Logout
      await page.click('button:has-text("Log Out")');

      // Go to login
      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');
      await page.fill('#username', username);
      await page.fill('#password', password);
      await page.click('#login-btn');

      await expect(page.locator('#twoFaCode')).toBeVisible();
      await expect(page.locator('.auth-subtitle')).toContainText('2FA code');
      await expect(page.getByTestId('error')).not.toBeVisible();
    });

    test('should show error for invalid 2FA code', async ({ page }) => {
      const timestamp = Date.now();
      const { username, password } = await createUserAndLogin(page, timestamp);

      // Enable 2FA
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();
      await expect(page.getByTestId('twofa-secret')).toBeVisible();

      // Logout
      await page.click('button:has-text("Log Out")');

      // Go to login
      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');
      await page.fill('#username', username);
      await page.fill('#password', password);
      await page.click('#login-btn');

      // Enter invalid 2FA code
      await expect(page.locator('#twoFaCode')).toBeVisible();
      await page.fill('#twoFaCode', '000000');
      await page.click('#login-btn');

      // Should show error
      await expect(page.getByTestId('error')).toBeVisible();
    });

    test('should successfully login with valid 2FA code', async ({ page }) => {
      const timestamp = Date.now();
      const { username, password } = await createUserAndLogin(page, timestamp);

      // Enable 2FA and capture the secret
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();
      await expect(page.getByTestId('twofa-secret')).toBeVisible();
      const secret = await page.locator('.twofa-secret code').textContent();
      expect(secret).toBeTruthy();

      // Logout
      await page.click('button:has-text("Log Out")');

      // Go to login
      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');
      await page.fill('#username', username);
      await page.fill('#password', password);
      await page.click('#login-btn');

      // Enter valid 2FA code
      await expect(page.locator('#twoFaCode')).toBeVisible();
      const { otp } = await TOTP.generate(secret!);
      await page.fill('#twoFaCode', otp);
      await page.click('#login-btn');

      // Should successfully reach dashboard
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('h1')).toHaveText('Dashboard');
    });
  });

  test.describe('2FA Reset', () => {
    test('should display reset 2FA link', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Verify reset link exists
      await expect(page.getByTestId('show-2fa-reset-btn')).toBeVisible();
    });

    test('should show reset form when clicking reset link', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Click reset link
      await page.getByTestId('show-2fa-reset-btn').click();

      // Should show reset form
      await expect(page.getByTestId('twofa-reset-form')).toBeVisible();
      await expect(page.locator('#resetUsername')).toBeVisible();
      await expect(page.locator('#resetPassword')).toBeVisible();
    });

    test('should initiate reset with credentials', async ({ page }) => {
      const timestamp = Date.now();
      const { username, password } = await createUserAndLogin(page, timestamp);

      // Enable 2FA first
      await page.click('button[aria-label="Settings"]');
      await page.getByTestId('enable-2fa-btn').click();
      await expect(page.getByTestId('twofa-secret')).toBeVisible();

      // Click reset link
      await page.getByTestId('show-2fa-reset-btn').click();

      // Fill in credentials
      await page.fill('#resetUsername', username);
      await page.fill('#resetPassword', password);
      await page.getByTestId('initiate-2fa-reset-btn').click();

      // Should proceed to OTP step
      await expect(page.locator('#resetOtp')).toBeVisible();
    });

    test('should allow canceling reset', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Click reset link
      await page.getByTestId('show-2fa-reset-btn').click();
      await expect(page.getByTestId('twofa-reset-form')).toBeVisible();

      // Click cancel
      await page.click('button:has-text("Cancel")');

      // Form should be hidden
      await expect(page.getByTestId('twofa-reset-form')).not.toBeVisible();
    });
  });
});
