import { test, expect, type Page } from '@playwright/test';

test.describe('Email Verification', () => {
  const createUserAndLogin = async (page: Page, timestamp: number) => {
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `emailverify${timestamp}${rand}`;
    const email = `emailverify${timestamp}${rand}@example.com`;
    const password = 'VerifyPwd123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    return { username, email, password };
  };

  test('should show unverified status for new users', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    await expect(page.getByTestId('verification-banner')).toBeVisible();
  });

  test('should display verification banner on dashboard', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    const banner = page.getByTestId('verification-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Verify your email');
    await expect(banner.locator('button:has-text("Send Verification Email")')).toBeVisible();
  });

  test('should send verification email', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Click send verification email
    const banner = page.getByTestId('verification-banner');
    await banner.locator('button:has-text("Send Verification Email")').click();

    // Should show code input after sending
    await expect(banner.locator('#verificationCode')).toBeVisible();
    await expect(banner.locator('button:has-text("Verify")')).toBeVisible();
  });

  test('should show pending status after email sent', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Click send verification email
    const banner = page.getByTestId('verification-banner');
    await banner.locator('button:has-text("Send Verification Email")').click();

    // Should update text to indicate pending
    await expect(banner).toContainText('verification code');
  });

  test('should show error for invalid verification code', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Send verification email
    const banner = page.getByTestId('verification-banner');
    await banner.locator('button:has-text("Send Verification Email")').click();

    // Enter invalid code
    await banner.locator('#verificationCode').fill('000000');
    await banner.locator('button:has-text("Verify")').click();

    // Should show error
    await expect(banner.locator('.verification-error')).toBeVisible();
  });

  test('should require non-empty code', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Send verification email
    const banner = page.getByTestId('verification-banner');
    await banner.locator('button:has-text("Send Verification Email")').click();

    // Code input should be empty initially
    await expect(banner.locator('#verificationCode')).toHaveValue('');

    // Verify button should be disabled for empty code
    await expect(banner.locator('button:has-text("Verify")')).toBeDisabled();
  });
  
  test('should persist verification banner across page reload', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Verify banner is visible
    await expect(page.getByTestId('verification-banner')).toBeVisible();

    // Reload page
    await page.reload();

    // Banner should still be visible for unverified user
    await expect(page.getByTestId('verification-banner')).toBeVisible();
  });

  test('should successfully verify email with correct code', async ({ page, request }) => {
    const timestamp = Date.now();
    const { email } = await createUserAndLogin(page, timestamp);

    // Send verification email
    const banner = page.getByTestId('verification-banner');
    await banner.locator('button:has-text("Send Verification Email")').click();

    // Wait for code input to appear
    await expect(banner.locator('#verificationCode')).toBeVisible();

    // Fetch the verification code from test endpoint
    const tokenResponse = await request.get(
      `http://localhost:3457/test/tokens?email=${encodeURIComponent(email)}&type=verification`
    );
    const { token: verificationCode } = await tokenResponse.json();
    expect(verificationCode).toBeTruthy();

    // Enter the correct code
    await banner.locator('#verificationCode').fill(verificationCode);
    await banner.locator('button:has-text("Verify")').click();

    // Banner should disappear after successful verification
    await expect(page.getByTestId('verification-banner')).not.toBeVisible();
  });

  test('should persist verified status across page reload', async ({ page, request }) => {
    const timestamp = Date.now();
    const { email } = await createUserAndLogin(page, timestamp);

    // Send verification email and verify
    const banner = page.getByTestId('verification-banner');
    await banner.locator('button:has-text("Send Verification Email")').click();
    await expect(banner.locator('#verificationCode')).toBeVisible();

    // Fetch and enter the correct code
    const tokenResponse = await request.get(
      `http://localhost:3457/test/tokens?email=${encodeURIComponent(email)}&type=verification`
    );
    const { token: verificationCode } = await tokenResponse.json();
    await banner.locator('#verificationCode').fill(verificationCode);
    await banner.locator('button:has-text("Verify")').click();

    // Wait for banner to disappear
    await expect(page.getByTestId('verification-banner')).not.toBeVisible();

    // Reload page
    await page.reload();

    // Banner should still be hidden (user is verified)
    await expect(page.getByTestId('verification-banner')).not.toBeVisible();
  });
});
