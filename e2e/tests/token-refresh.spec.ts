import { test, expect, type Page } from '@playwright/test';

/** Decode a JWT and return the payload */
const decodeJwt = (token: string): { exp?: number; iat?: number; id?: number; userId?: number } => {
  const base64 = token.split('.')[1];
  if (!base64) throw new Error('Invalid JWT');
  return JSON.parse(Buffer.from(base64, 'base64url').toString());
};

/** Get the auth-token cookie value from the browser context */
const getAuthToken = async (page: Page): Promise<string | null> => {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === 'auth-token')?.value ?? null;
};

/** Call auth.refresh via raw fetch and return whether it succeeded */
const callRefresh = async (page: Page): Promise<boolean> => {
  return page.evaluate(() =>
    fetch('/api/auth.refresh', { credentials: 'include' }).then((r) => r.ok)
  );
};

test.describe('Rolling Window Token Refresh', () => {
  const createUserAndLogin = async (page: Page) => {
    const timestamp = Date.now();
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

  test('refresh should issue a new JWT with a later exp', async ({ page }) => {
    await createUserAndLogin(page);

    const initialToken = await getAuthToken(page);
    expect(initialToken).toBeTruthy();
    const initialPayload = decodeJwt(initialToken!);
    expect(initialPayload.exp).toBeDefined();

    // Wait so the new token will have a measurably later iat/exp
    await page.waitForTimeout(2000);

    expect(await callRefresh(page)).toBe(true);

    const refreshedToken = await getAuthToken(page);
    expect(refreshedToken).toBeTruthy();
    expect(refreshedToken).not.toBe(initialToken);

    const refreshedPayload = decodeJwt(refreshedToken!);
    expect(refreshedPayload.exp).toBeDefined();

    // The new exp should be later than the original
    expect(refreshedPayload.exp!).toBeGreaterThan(initialPayload.exp!);
  });

  test('refresh should preserve the same session ID', async ({ page }) => {
    await createUserAndLogin(page);

    const initialToken = await getAuthToken(page);
    const initialPayload = decodeJwt(initialToken!);

    await page.waitForTimeout(1000);
    await callRefresh(page);

    const refreshedToken = await getAuthToken(page);
    const refreshedPayload = decodeJwt(refreshedToken!);

    // Session ID and user ID should remain the same
    expect(refreshedPayload.id).toBe(initialPayload.id);
    expect(refreshedPayload.userId).toBe(initialPayload.userId);
  });

  test('refreshed token lifetime should match the configured jwtExpiry', async ({ page }) => {
    await createUserAndLogin(page);

    await page.waitForTimeout(1000);
    await callRefresh(page);

    const refreshedToken = await getAuthToken(page);
    const payload = decodeJwt(refreshedToken!);

    // jwtExpiry is 60s in e2e config, so exp - iat should be 60
    const lifetime = payload.exp! - payload.iat!;
    expect(lifetime).toBe(60);
  });


  test('cleared token should not allow refresh', async ({ page }) => {
    await createUserAndLogin(page);

    await page.context().clearCookies();
    await page.reload();

    // Should be on auth page, not dashboard
    await expect(page.locator('.auth-page')).toBeVisible();
    await expect(page.locator('.dashboard')).not.toBeVisible();
  });

  test('should restore auth state on page reload within the window', async ({ page }) => {
    const { username, email } = await createUserAndLogin(page);

    await page.reload();

    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.welcome-card h2')).toContainText(`Welcome, ${username}`);
    await expect(page.locator('.welcome-card .email')).toContainText(email);
  });
});
