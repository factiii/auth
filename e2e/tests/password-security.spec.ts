import { test, expect, type Page } from '@playwright/test';

test.describe('Password Security', () => {
  const createUserAndLogin = async (page: Page, customPassword?: string) => {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const username = `pwdsec${timestamp}${rand}`;
    const email = `pwdsec${timestamp}${rand}@example.com`;
    const password = customPassword || 'PwdSec123';

    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit-btn');

    return { username, email, password };
  };

  test.describe('Password Hashing', () => {
    test('MUST be case-sensitive (proves hashing)', async ({ page }) => {
      const { username, password } = await createUserAndLogin(page);
      await expect(page.locator('.dashboard')).toBeVisible();

      await page.click('button:has-text("Log Out")');
      await page.click('button:has-text("Log in")');
      await page.fill('#username', username);
      await page.fill('#password', password.toLowerCase()); // Different case
      await page.click('#login-btn');

      await expect(page.getByTestId('error')).toBeVisible();
    });

    test('MUST reject passwords longer than 72 bytes', async ({ page }) => {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      await page.goto('/');
      await page.fill('#username', `longpwd_${timestamp}${rand}`);
      await page.fill('#email', `longpwd_${timestamp}${rand}@example.com`);
      await page.fill('#password', 'A'.repeat(73)); // Exceeds 72 byte bcrypt limit
      await page.click('#submit-btn');

      await expect(page.getByTestId('error')).toBeVisible();
      await expect(page.getByTestId('error')).toContainText('72');
    });
  });
});
