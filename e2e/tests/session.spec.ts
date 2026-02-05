import { test, expect, type Page } from '@playwright/test';

test.describe('Session Management', () => {
  const createUserAndLogin = async (page: Page, timestamp: number) => {
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `session${timestamp}${rand}`;
    const email = `session${timestamp}${rand}@example.com`;
    const password = 'SessionPwd123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    return { username, email, password };
  };

  test.describe('Session Persistence', () => {
    test('should maintain session across page navigation', async ({ page }) => {
      const timestamp = Date.now();
      const { username } = await createUserAndLogin(page, timestamp);

      // Verify on dashboard
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);

      // Navigate away and back (simulate by going to home and relying on session)
      await page.goto('/');

      // Should still be logged in
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    });

    test('should clear session on logout', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Logout
      await page.click('button:has-text("Log Out")');

      // Should be back at signup page
      await expect(page.locator('h1')).toHaveText('Create Account');

      // Reload to verify session is truly cleared
      await page.reload();

      // Should still be at auth page, not dashboard
      await expect(page.locator('.dashboard')).not.toBeVisible();
      await expect(page.locator('.auth-page')).toBeVisible();
    });

    test('should restore session on page reload', async ({ page }) => {
      const timestamp = Date.now();
      const { username } = await createUserAndLogin(page, timestamp);

      // Reload the page
      await page.reload();

      // Should still be on dashboard
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    });

    test('should show user info correctly after session restore', async ({ page }) => {
      const timestamp = Date.now();
      const { username, email } = await createUserAndLogin(page, timestamp);

      // Reload the page
      await page.reload();

      // Verify user info is displayed correctly
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
      await expect(page.locator('.welcome-card .email')).toContainText(email);
    });
  });

  test.describe('End All Sessions', () => {
    test('should display end all sessions button', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');
      await expect(page.locator('.settings-panel')).toBeVisible();

      // Verify end all sessions button exists
      await expect(page.locator('button:has-text("End All Other Sessions")')).toBeVisible();
    });

    test('should show confirmation dialog', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Set up dialog handler before clicking
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('other devices');
        await dialog.dismiss();
      });

      // Click end all sessions
      await page.click('button:has-text("End All Other Sessions")');
    });

    test('should end other sessions and show count', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Accept the confirmation dialog
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Click end all sessions
      await page.click('button:has-text("End All Other Sessions")');

      // Should show success message with count (even if 0 sessions)
      await expect(page.locator('.settings-panel .success')).toBeVisible();
      await expect(page.locator('.settings-panel .success')).toContainText('session');
    });

    test('should keep current session active after ending others', async ({ page }) => {
      const timestamp = Date.now();
      const { username } = await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Accept the confirmation dialog
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Click end all sessions
      await page.click('button:has-text("End All Other Sessions")');

      // Wait for success message
      await expect(page.locator('.settings-panel .success')).toBeVisible();

      // Current session should still be active - user should still be logged in
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);

      // Reload to verify session is still valid
      await page.reload();
      await expect(page.locator('.dashboard')).toBeVisible();
    });

    test('should terminate other sessions while keeping current session', async ({ browser }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `session${timestamp}${rand}`;
      const email = `session${timestamp}${rand}@example.com`;
      const password = 'SessionPwd123';

      // Create first browser context (Session A)
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();

      // Sign up and login in Session A
      await pageA.goto('/');
      await pageA.fill('#username', username);
      await pageA.fill('#email', email);
      await pageA.fill('#password', password);
      await pageA.click('#submit-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Logout from Session A
      await pageA.click('button:has-text("Log Out")');
      await expect(pageA.locator('.auth-page')).toBeVisible();

      // Create second browser context (Session B)
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();

      // Login in Session B
      await pageB.goto('/');
      await expect(pageB.locator('.auth-page')).toBeVisible();
      await pageB.click('button:has-text("Log in")');
      await expect(pageB.locator('h1')).toHaveText('Welcome Back');
      await pageB.fill('#username', username);
      await pageB.fill('#password', password);
      await pageB.click('#login-btn');
      await expect(pageB.locator('.dashboard')).toBeVisible();

      // Login again in Session A (now we have two active sessions)
      await pageA.click('button:has-text("Log in")');
      await expect(pageA.locator('h1')).toHaveText('Welcome Back');
      await pageA.fill('#username', username);
      await pageA.fill('#password', password);
      await pageA.click('#login-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // From Session A, end all other sessions
      await pageA.click('button[aria-label="Settings"]');
      pageA.once('dialog', async (dialog) => {
        await dialog.accept();
      });
      await pageA.click('button:has-text("End All Other Sessions")');

      // Wait for success message in Session A
      await expect(pageA.locator('.settings-panel .success')).toBeVisible();
      await expect(pageA.locator('.settings-panel .success')).toContainText('1 session');

      // Verify Session A is still active
      await pageA.reload();
      await expect(pageA.locator('.dashboard')).toBeVisible();
      await expect(pageA.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);

      // Verify Session B is now invalid - reload should show auth page
      await pageB.reload();
      await expect(pageB.locator('.dashboard')).not.toBeVisible();
      await expect(pageB.locator('.auth-page')).toBeVisible();

      // Cleanup
      await contextA.close();
      await contextB.close();
    });

    test('should show loading state while ending sessions', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Add delay to API to catch loading state
      await page.route('**/api**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      // Accept the confirmation dialog
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      const endSessionsBtn = page.locator('.security-section button.btn-danger');
      await endSessionsBtn.click();
      await expect(endSessionsBtn).toHaveText('Ending sessions...', { timeout: 1000 });
    });
  });

  test.describe('Security Section', () => {
    test('should display security section in settings', async ({ page }) => {
      const timestamp = Date.now();
      await createUserAndLogin(page, timestamp);

      // Open settings
      await page.click('button[aria-label="Settings"]');

      // Verify security section exists
      await expect(page.locator('.security-section h4')).toHaveText('Security');
      await expect(page.locator('.security-section p')).toContainText('other active sessions');
    });
  });
});
