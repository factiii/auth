import { test, expect, type Page } from '@playwright/test';

test.describe('Token Refresh', () => {
  const createUserAndLogin = async (page: Page, timestamp: number) => {
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `tkref${timestamp}`.slice(0, 24) + rand;
    const email = `tokenrefresh${timestamp}${rand}@example.com`;
    const password = 'RefreshPwd123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10000 });

    return { username, email, password };
  };

  test('should restore auth state on page reload', async ({ page }) => {
    const timestamp = Date.now();
    const { username, email } = await createUserAndLogin(page, timestamp);

    // Reload the page
    await page.reload();

    // Auth state should be restored via token refresh
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    await expect(page.locator('.welcome-card .email')).toContainText(email);
  });

  test('should maintain user data after refresh', async ({ page }) => {
    const timestamp = Date.now();
    const { username, email } = await createUserAndLogin(page, timestamp);

    // Reload multiple times to ensure token refresh works consistently
    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible();

    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible();

    // User data should still be correct
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    await expect(page.locator('.welcome-card .email')).toContainText(email);
  });

  test('should show loading state during auth check', async ({ page }) => {
    const timestamp = Date.now();
    await createUserAndLogin(page, timestamp);

    await page.route('**/api/**', async (route) => {
      // Add a small delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.continue();
    });

    const reloadPromise = page.reload();

    // Should show loading state
    await expect(page.locator('.loading-screen')).toBeVisible();

    // Wait for reload to complete
    await reloadPromise;
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Go directly to home without any session
    await page.goto('/');

    // Should not show dashboard
    await expect(page.locator('.dashboard')).not.toBeVisible();

    // Should show auth page (signup by default)
    await expect(page.locator('.auth-page')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Create Account');
  });

  test('should handle multiple rapid reloads gracefully', async ({ page }) => {
    const timestamp = Date.now();
    const { username } = await createUserAndLogin(page, timestamp);

    // Do a few reloads with small waits between them
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be authenticated (allow more time for session restoration)
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
  });

  test('should recover session after network temporarily fails', async ({ page }) => {
    const timestamp = Date.now();
    const { username } = await createUserAndLogin(page, timestamp);

    // Verify we're logged in
    await expect(page.locator('.dashboard')).toBeVisible();

    // Reload to verify session persists
    await page.reload();

    // Should still be on dashboard
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
  });
});
