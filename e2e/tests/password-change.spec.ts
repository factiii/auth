import { test, expect, type Page } from '@playwright/test';

test.describe('Password Change', () => {
  const createUserAndLogin = async (page: Page, timestamp: number) => {
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `pwdchange${timestamp}${rand}`;
    const email = `pwdchange${timestamp}${rand}@example.com`;
    const password = 'OldPassword123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    return { username, email, password };
  };

  test('should display change password form in settings', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Open settings panel
    await page.click('button[aria-label="Settings"]');
    await expect(page.locator('.settings-panel')).toBeVisible();

    // Verify password change form elements
    await expect(page.locator('.settings-panel h3')).toHaveText('Account Settings');
    await expect(page.locator('.settings-panel h4').first()).toHaveText('Change Password');
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('button:has-text("Update Password")')).toBeVisible();
  });

  test('should successfully change password', async ({ page }) => {
    const timestamp = Date.now();
    const { password } = await createUserAndLogin(page, timestamp);
    const newPassword = 'NewPassword456';

    // Open settings and change password
    await page.click('button[aria-label="Settings"]');
    await page.fill('#currentPassword', password);
    await page.fill('#newPassword', newPassword);
    await page.click('button:has-text("Update Password")');

    // Should show success message
    await expect(page.locator('.settings-panel .success')).toBeVisible();
    await expect(page.locator('.settings-panel .success')).toContainText('Password');
  });

  test('should show error for incorrect current password', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    // Open settings and try to change with wrong current password
    await page.click('button[aria-label="Settings"]');
    await page.fill('#currentPassword', 'WrongCurrentPassword');
    await page.fill('#newPassword', 'NewPassword456');
    await page.click('button:has-text("Update Password")');

    // Should show error message
    await expect(page.locator('.settings-panel .error')).toBeVisible();
  });

  test('should show error when new password same as current', async ({ page }) => {
    const timestamp = Date.now();
    const { password } = await createUserAndLogin(page, timestamp);

    // Open settings and try to change to same password
    await page.click('button[aria-label="Settings"]');
    await page.fill('#currentPassword', password);
    await page.fill('#newPassword', password);
    await page.click('button:has-text("Update Password")');

    // Should show error message
    await expect(page.locator('.settings-panel .error')).toBeVisible();
  });

  test('should validate new password minimum length (6 chars)', async ({ page }) => {
    const timestamp = Date.now();
    const { password } = await createUserAndLogin(page, timestamp);

    // Open settings and try to change to short password
    await page.click('button[aria-label="Settings"]');
    await page.fill('#currentPassword', password);
    await page.fill('#newPassword', '12345');
    await page.click('button:has-text("Update Password")');

    // Should show error about password length
    await expect(page.locator('.settings-panel .error')).toBeVisible();
    await expect(page.locator('.settings-panel .error')).toContainText('6 characters');
  });

  test('should login with new password after change', async ({ page }) => {
    const timestamp = Date.now();
    const { username, password } = await createUserAndLogin(page, timestamp);
    const newPassword = 'NewPassword789';

    // Change password
    await page.click('button[aria-label="Settings"]');
    await page.fill('#currentPassword', password);
    await page.fill('#newPassword', newPassword);
    await page.click('button:has-text("Update Password")');
    await expect(page.locator('.settings-panel .success')).toBeVisible();

    // Logout
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h1')).toHaveText('Create Account');

    // Switch to login and try with new password
    await page.click('button:has-text("Log in")');
    await expect(page.locator('h1')).toHaveText('Welcome Back');
    await page.fill('#username', username);
    await page.fill('#password', newPassword);
    await page.click('#login-btn');

    // Should successfully login with new password
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
  });

  test('should show success message after change', async ({ page }) => {
    const timestamp = Date.now();
    const { password } = await createUserAndLogin(page, timestamp);

    await page.click('button[aria-label="Settings"]');
    await page.fill('#currentPassword', password);
    await page.fill('#newPassword', 'AnotherNewPwd123');
    await page.click('button:has-text("Update Password")');

    const successMessage = page.locator('.settings-panel .success');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('Password');
  });
});
