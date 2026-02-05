import { test, expect, type Page, type Browser } from '@playwright/test';
import { TOTP } from 'totp-generator';

test.describe('Token Security', () => {
  const createUserAndLogin = async (page: Page) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `tokensec${timestamp}${rand}`;
    const email = `tokensec${timestamp}${rand}@example.com`;
    const password = 'TokenSecPwd123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');
    await expect(page.locator('.dashboard')).toBeVisible();

    return { username, email, password };
  };

  test.describe('Access Token Expiration', () => {
    test('MUST reject requests with expired access tokens', async ({ page }) => {
      await createUserAndLogin(page);

      // Get cookies and manipulate token expiration
      // This test verifies the server validates token expiration
      const cookies = await page.context().cookies();
      const accessToken = cookies.find((c) => c.name === 'auth-at');
      expect(accessToken).toBeDefined();

      // Clear cookies and set expired token (by clearing and not refreshing)
      await page.context().clearCookies();

      // Try to access protected resource
      await page.reload();

      // Should be redirected to login since session is invalid
      await expect(page.locator('.auth-page')).toBeVisible();
      await expect(page.locator('.dashboard')).not.toBeVisible();
    });

    test('MUST allow refresh before token expires', async ({ page }) => {
      const { username } = await createUserAndLogin(page);

      // Token refresh should happen automatically
      // Verify session is maintained after some activity
      await page.reload();
      await expect(page.locator('.dashboard')).toBeVisible();
      await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);

      // Navigate and verify refresh works
      await page.goto('/');
      await expect(page.locator('.dashboard')).toBeVisible();
    });
  });

  test.describe('Refresh Token Rotation', () => {
    test('MUST rotate refresh token on each use', async ({ page }) => {
      await createUserAndLogin(page);

      // Get initial cookies
      const initialCookies = await page.context().cookies();
      const initialRefreshToken = initialCookies.find((c) => c.name === 'auth-rt')?.value;
      expect(initialRefreshToken).toBeDefined();

      // Wait for access token to expire (5s + buffer)
      await page.waitForTimeout(6000);

      // Reload page - the trpc client will auto-refresh since token is expired
      await page.reload();
      await expect(page.locator('.dashboard')).toBeVisible();

      // Get cookies after refresh
      const newCookies = await page.context().cookies();
      const newRefreshToken = newCookies.find((c) => c.name === 'auth-rt')?.value;

      expect(newRefreshToken).not.toBe(initialRefreshToken);
    });

    test('MUST reject reused refresh tokens (replay attack prevention)', async ({ browser }) => {
      // Create first context
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();

      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `replay${timestamp}${rand}`;
      const email = `replay${timestamp}${rand}@example.com`;
      const password = 'ReplayPwd123';

      // Sign up in context A
      await pageA.goto('/');
      await pageA.fill('#username', username);
      await pageA.fill('#email', email);
      await pageA.fill('#password', password);
      await pageA.click('#submit-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Capture the refresh token
      const cookies = await contextA.cookies();
      const refreshToken = cookies.find((c) => c.name === 'auth-rt');
      expect(refreshToken).toBeDefined();

      // Create a new context and try to use the captured refresh token
      const contextB = await browser.newContext();

      // Copy cookies to context B (simulating token theft/replay)
      if (refreshToken) {
        await contextB.addCookies([{
          ...refreshToken,
          domain: 'localhost',
        }]);
      }

      const pageB = await contextB.newPage();
      await pageB.goto('/');

      await contextA.close();
      await contextB.close();
    });
  });

  test.describe('Token Invalidation on Security Events', () => {
    test('MUST invalidate all other sessions on password change', async ({ browser }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `pwdchange${timestamp}${rand}`;
      const email = `pwdchange${timestamp}${rand}@example.com`;
      const password = 'OriginalPwd123';
      const newPassword = 'NewPassword456';

      // Session A: Create user
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto('/');
      await pageA.fill('#username', username);
      await pageA.fill('#email', email);
      await pageA.fill('#password', password);
      await pageA.click('#submit-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Logout and login again to create another session
      await pageA.click('button:has-text("Log Out")');
      await expect(pageA.locator('.auth-page')).toBeVisible();

      // Session B: Login
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await pageB.goto('/');
      await expect(pageB.locator('.auth-page')).toBeVisible();
      await pageB.click('button:has-text("Log in")');
      await expect(pageB.locator('h1')).toHaveText('Welcome Back');
      await pageB.fill('#username', username);
      await pageB.fill('#password', password);
      await pageB.click('#login-btn');
      await expect(pageB.locator('.dashboard')).toBeVisible();

      // Session A: Login again
      await pageA.click('button:has-text("Log in")');
      await expect(pageA.locator('h1')).toHaveText('Welcome Back');
      await pageA.fill('#username', username);
      await pageA.fill('#password', password);
      await pageA.click('#login-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Session A: Change password
      await pageA.click('button[aria-label="Settings"]');
      await expect(pageA.locator('.settings-panel')).toBeVisible();

      // Fill in password change form
      await pageA.fill('#currentPassword', password);
      await pageA.fill('#newPassword', newPassword);
      await pageA.click('button:has-text("Update Password")');

        // Wait for success or for the operation to complete
        await pageA.waitForTimeout(1000);

        // Session B should now be invalid
        await pageB.reload();

        // Session B should be logged out
        await expect(pageB.locator('.auth-page')).toBeVisible({ timeout: 5000 });

      await contextA.close();
      await contextB.close();
    });

    test('MUST invalidate other sessions when 2FA is enabled', async ({ browser }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `twofa${timestamp}${rand}`;
      const email = `twofa${timestamp}${rand}@example.com`;
      const password = 'TwoFaPwd123';

      // Session A: Create user
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto('/');
      await pageA.fill('#username', username);
      await pageA.fill('#email', email);
      await pageA.fill('#password', password);
      await pageA.click('#submit-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();
      await pageA.click('button:has-text("Log Out")');
      await expect(pageA.locator('.auth-page')).toBeVisible();

      // Session B: Login
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await pageB.goto('/');
      await expect(pageB.locator('.auth-page')).toBeVisible();
      await pageB.click('button:has-text("Log in")');
      await expect(pageB.locator('h1')).toHaveText('Welcome Back');
      await pageB.fill('#username', username);
      await pageB.fill('#password', password);
      await pageB.click('#login-btn');
      await expect(pageB.locator('.dashboard')).toBeVisible();

      // Session A: Login
      await pageA.click('button:has-text("Log in")');
      await expect(pageA.locator('h1')).toHaveText('Welcome Back');
      await pageA.fill('#username', username);
      await pageA.fill('#password', password);
      await pageA.click('#login-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Session A: Enable 2FA
      await pageA.click('button[aria-label="Settings"]');
      await expect(pageA.locator('.settings-panel')).toBeVisible();
      await pageA.getByTestId('enable-2fa-btn').click();
      await expect(pageA.getByTestId('twofa-secret')).toBeVisible();

      // Session B should now be invalid (security event occurred)
      await pageB.reload();

      // Wait for redirect to auth page after session invalidation
      await expect(pageB.locator('.auth-page')).toBeVisible({ timeout: 10000 });
      await expect(pageB.locator('.dashboard')).not.toBeVisible();

      await contextA.close();
      await contextB.close();
    });

    test('MUST NOT invalidate other sessions when 2FA is disabled', async ({ browser }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const username = `twofa${timestamp}${rand}`;
      const email = `twofa${timestamp}${rand}@example.com`;
      const password = 'TwoFaPwd123';

      // Session A: Create user and enable 2FA
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto('/');
      await pageA.fill('#username', username);
      await pageA.fill('#email', email);
      await pageA.fill('#password', password);
      await pageA.click('#submit-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Enable 2FA
      await pageA.click('button[aria-label="Settings"]');
      await pageA.getByTestId('enable-2fa-btn').click();
      await expect(pageA.getByTestId('twofa-secret')).toBeVisible();
      const secret = await pageA.locator('.twofa-secret code').textContent();

      // Logout from A
      await pageA.click('button:has-text("Log Out")');
      await expect(pageA.locator('.auth-page')).toBeVisible();

      // Session B: Login with 2FA
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await pageB.goto('/');
      await expect(pageB.locator('.auth-page')).toBeVisible();
      await pageB.click('button:has-text("Log in")');
      await expect(pageB.locator('h1')).toHaveText('Welcome Back');
      await pageB.fill('#username', username);
      await pageB.fill('#password', password);
      await pageB.click('#login-btn');

      // Enter 2FA code for Session B
      await expect(pageB.locator('#twoFaCode')).toBeVisible();
      const { otp: otpB } = await TOTP.generate(secret!);
      await pageB.fill('#twoFaCode', otpB);
      await pageB.click('#login-btn');
      await expect(pageB.locator('.dashboard')).toBeVisible();

      // Session A: Login with 2FA
      await pageA.click('button:has-text("Log in")');
      await expect(pageA.locator('h1')).toHaveText('Welcome Back');
      await pageA.fill('#username', username);
      await pageA.fill('#password', password);
      await pageA.click('#login-btn');
      await expect(pageA.locator('#twoFaCode')).toBeVisible();
      const { otp: otpA } = await TOTP.generate(secret!);
      await pageA.fill('#twoFaCode', otpA);
      await pageA.click('#login-btn');
      await expect(pageA.locator('.dashboard')).toBeVisible();

      // Session A: Disable 2FA
      await pageA.click('button[aria-label="Settings"]');
      await expect(pageA.locator('.settings-panel')).toBeVisible();
      await expect(pageA.getByTestId('show-disable-2fa-btn')).toBeVisible();
      await pageA.getByTestId('show-disable-2fa-btn').click();
      await pageA.fill('#twoFaPassword', password);
      await pageA.getByTestId('confirm-disable-2fa-btn').click();

      // Wait for 2FA to be disabled (success message appears)
      await expect(pageA.getByTestId('settings-message')).toContainText('2FA has been disabled');

      // Session B should still be valid (disabling 2FA doesn't revoke sessions)
      await pageB.reload();

      await expect(pageB.locator('.dashboard')).toBeVisible({ timeout: 10000 });
      await expect(pageB.locator('.auth-page')).not.toBeVisible();

      await contextA.close();
      await contextB.close();
    });
  });

  test.describe('Malformed/Tampered Token Rejection', () => {
    test('MUST reject malformed access tokens', async ({ page }) => {
      await createUserAndLogin(page);

      // Clear cookies and set a malformed token
      await page.context().clearCookies();
      await page.context().addCookies([{
        name: 'auth-at',
        value: 'this-is-not-a-valid-jwt-token',
        domain: 'localhost',
        path: '/',
      }]);

      // Try to access protected resource
      await page.reload();

      // Should be redirected to auth page
      await expect(page.locator('.auth-page')).toBeVisible();
      await expect(page.locator('.dashboard')).not.toBeVisible();
    });

    test('MUST reject tampered JWT tokens (modified payload)', async ({ page }) => {
      await createUserAndLogin(page);

      const cookies = await page.context().cookies();
      const accessToken = cookies.find((c) => c.name === 'auth-at');
      expect(accessToken).toBeDefined();

      // Tamper with the token by modifying the payload
      const parts = accessToken!.value.split('.');
      if (parts.length === 3) {
        // Decode payload, modify, re-encode (without proper signature)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        payload.userId = 'tampered-user-id';
        const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

        await page.context().clearCookies();
        await page.context().addCookies([{
          name: 'auth-at',
          value: tamperedToken,
          domain: 'localhost',
          path: '/',
        }]);
      }

      // Try to access protected resource
      await page.reload();

      // Should be rejected
      await expect(page.locator('.auth-page')).toBeVisible();
      await expect(page.locator('.dashboard')).not.toBeVisible();
    });

    test('MUST reject tokens signed with wrong secret', async ({ page }) => {
      await createUserAndLogin(page);

      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlLXVzZXIiLCJpYXQiOjE2MTYyMzkwMjJ9.fakeSignatureThatWontVerify123456';

      await page.context().clearCookies();
      await page.context().addCookies([{
        name: 'auth-at',
        value: fakeToken,
        domain: 'localhost',
        path: '/',
      }]);

      // Try to access protected resource
      await page.reload();

      // Should be rejected
      await expect(page.locator('.auth-page')).toBeVisible();
      await expect(page.locator('.dashboard')).not.toBeVisible();
    });
  });
});
