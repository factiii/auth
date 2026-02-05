import { test, expect } from '@playwright/test';

test.describe('Input Boundary Tests', () => {
  const timestamp = () => Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('SQL Injection Prevention', () => {
    test('MUST NOT allow auth bypass via SQL injection', async ({ page, request }) => {
      const ts = timestamp();
      const r = rand();
      const username = `sqliuser${ts}${r}`;
      const email = `sqliuser${ts}${r}@example.com`;
      const password = 'RealPassword123';

      await page.goto('/');
      await page.fill('#username', username);
      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('#submit-btn');
      await expect(page.locator('.dashboard')).toBeVisible();
      await page.click('button:has-text("Log Out")');
      await expect(page.locator('.auth-page')).toBeVisible();

      // Try SQL injection payloads to bypass auth
      const bypassPayloads = [
        "' OR '1'='1",
        "' OR '1'='1'--",
        "admin'--",
        `${username}'--`,
      ];

      await page.click('button:has-text("Log in")');
      await expect(page.locator('h1')).toHaveText('Welcome Back');

      for (const payload of bypassPayloads) {
        await page.fill('#username', payload);
        await page.fill('#password', 'wrongpassword');
        await page.click('#login-btn');

        await page.waitForSelector('.dashboard, [data-testid="error"]');
        const loggedIn = await page.locator('.dashboard').isVisible().catch(() => false);

        expect(loggedIn).toBe(false);
      }

      const response = await request.post('http://localhost:3457/auth.signup', {
        headers: { 'Content-Type': 'application/json' },
        data: { username: "'; DROP TABLE users;--", email: `sqldrop${ts}@example.com`, password: 'Password123' },
      });
      const body = await response.text();
      expect(body.toLowerCase()).not.toContain('sql');
      expect(body.toLowerCase()).not.toContain('syntax');
      expect(body.toLowerCase()).not.toContain('postgres');
    });
  });

  test.describe('Long Input Handling', () => {
    test('MUST reject username exceeding max length (30 chars)', async ({ page }) => {
      const longUsername = 'a'.repeat(31);

      await page.fill('#username', longUsername);
      await page.fill('#email', `long${timestamp()}@example.com`);
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');

      await page.waitForSelector('.dashboard, [data-testid="error"]');
      const hasError = await page.getByTestId('error').isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });

    test('MUST reject emails exceeding max length (254 chars)', async ({ page }) => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // > 254 chars

      await page.fill('#username', `longemail${timestamp()}`);
      await page.fill('#email', longEmail);
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');

      await page.waitForSelector('.dashboard, [data-testid="error"]');
      const hasError = await page.getByTestId('error').isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });
  });

  test.describe('Null Byte Injection', () => {
    test('MUST reject null bytes in username', async ({ page }) => {
      const payloads = [
        'admin\x00ignored',
        'admin%00ignored',
        'admin\u0000rest',
      ];

      for (const payload of payloads) {
        await page.goto('/');
        await page.fill('#username', payload);
        await page.fill('#email', `null${timestamp()}${rand()}@example.com`);
        await page.fill('#password', 'Password123');
        await page.click('#submit-btn');

        await page.waitForSelector('.dashboard, [data-testid="error"]');
        const hasError = await page.getByTestId('error').isVisible().catch(() => false);

        expect(hasError).toBe(true);
      }
    });

    test('MUST reject null byte sequences via API', async ({ request }) => {
      const response = await request.post('http://localhost:3457/auth.signup', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          username: 'admin\x00ignored',
          email: `null${timestamp()}@example.com`,
          password: 'Password123',
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Unicode/Encoding Attacks', () => {
    test('MUST reject homoglyph usernames', async ({ page }) => {
      // Create user with Latin 'a'
      const ts = timestamp();
      await page.fill('#username', `admin${ts}`);
      await page.fill('#email', `admin${ts}@example.com`);
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');
      await expect(page.locator('.dashboard')).toBeVisible();
      await page.click('button:has-text("Log Out")');
      await expect(page.locator('.auth-page')).toBeVisible();

      // Try to create user with Cyrillic 'а' (looks identical) - MUST be rejected
      await page.goto('/');
      await page.fill('#username', `аdmin${ts}`); // Cyrillic 'а'
      await page.fill('#email', `homoglyph${ts}@example.com`);
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');

      await page.waitForSelector('.dashboard, [data-testid="error"]');
      const hasError = await page.getByTestId('error').isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });

    test('MUST reject BOM characters in username', async ({ page }) => {
      const bomPrefix = '\uFEFF';

      await page.fill('#username', `${bomPrefix}bomuser${timestamp()}`);
      await page.fill('#email', `bom${timestamp()}@example.com`);
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');

      await page.waitForSelector('.dashboard, [data-testid="error"]');
      const hasError = await page.getByTestId('error').isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });

    test('MUST reject RTL override characters in username', async ({ page }) => {
      const rtlOverride = '\u202E';

      await page.fill('#username', `${rtlOverride}nimda${timestamp()}`);
      await page.fill('#email', `rtl${timestamp()}@example.com`);
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');

      await page.waitForSelector('.dashboard, [data-testid="error"]');
      const hasError = await page.getByTestId('error').isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });

    test('MUST accept emoji in passwords', async ({ page }) => {
      await page.fill('#username', `emojiuser${timestamp()}`);
      await page.fill('#email', `emoji${timestamp()}@example.com`);
      await page.fill('#password', 'Password🔐123🔑');
      await page.click('#submit-btn');

      await expect(page.locator('.dashboard')).toBeVisible();
    });
  });

  test.describe('Email Header Injection', () => {
    test('MUST reject email with newlines', async ({ page }) => {
      const payloads = [
        `victim@example.com\nBcc: attacker@evil.com`,
        `victim@example.com\r\nBcc: attacker@evil.com`,
      ];

      for (const payload of payloads) {
        await page.goto('/');
        await page.fill('#username', `headerinj${timestamp()}${rand()}`);
        await page.fill('#email', payload);
        await page.fill('#password', 'Password123');
        await page.click('#submit-btn');

        await page.waitForSelector('.dashboard, [data-testid="error"]');
        const hasError = await page.getByTestId('error').isVisible().catch(() => false);

        expect(hasError).toBe(true);
      }
    });

    test('MUST reject header injection attempts', async ({ page }) => {
      await page.fill('#username', `headertest${timestamp()}`);
      await page.fill('#email', 'test@example.com\nContent-Type: text/html');
      await page.fill('#password', 'Password123');
      await page.click('#submit-btn');

      await page.waitForSelector('.dashboard, [data-testid="error"]');
      const hasError = await page.getByTestId('error').isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });
  });

  test.describe('CRLF Injection', () => {
    test('MUST reject CRLF sequences in username', async ({ page }) => {
      const crlfPayloads = [
        'test\r\nSet-Cookie: malicious=value',
        'test\nSet-Cookie: malicious=value',
      ];

      for (const payload of crlfPayloads) {
        await page.goto('/');
        await page.fill('#username', payload);
        await page.fill('#email', `crlf${timestamp()}${rand()}@example.com`);
        await page.fill('#password', 'Password123');
        await page.click('#submit-btn');

        await page.waitForSelector('.dashboard, [data-testid="error"]');
        const hasError = await page.getByTestId('error').isVisible().catch(() => false);

        expect(hasError).toBe(true);
      }
    });

    test('MUST reject CRLF via API', async ({ request }) => {
      const response = await request.post('http://localhost:3457/auth.signup', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          username: 'test\r\nX-Injected: header',
          email: `crlf${timestamp()}@example.com`,
          password: 'Password123',
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Path Traversal', () => {
    test('MUST reject path traversal attempts in username', async ({ page }) => {
      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
      ];

      for (const payload of traversalPayloads) {
        await page.goto('/');
        await page.fill('#username', payload);
        await page.fill('#email', `traversal${timestamp()}${rand()}@example.com`);
        await page.fill('#password', 'Password123');
        await page.click('#submit-btn');

        await page.waitForSelector('.dashboard, [data-testid="error"]');
        const hasError = await page.getByTestId('error').isVisible().catch(() => false);

        expect(hasError).toBe(true);
      }
    });
  });

  test.describe('Command Injection', () => {
    test('MUST reject command injection attempts in username', async ({ page }) => {
      const commandPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(whoami)',
      ];

      for (const payload of commandPayloads) {
        await page.goto('/');
        await page.fill('#username', payload);
        await page.fill('#email', `cmd${timestamp()}${rand()}@example.com`);
        await page.fill('#password', 'Password123');
        await page.click('#submit-btn');

        await page.waitForSelector('.dashboard, [data-testid="error"]');
        const hasError = await page.getByTestId('error').isVisible().catch(() => false);

        expect(hasError).toBe(true);
      }
    });
  });

  test.describe('Type Confusion', () => {
    test('MUST reject non-string inputs via API', async ({ request }) => {
      const confusionPayloads = [
        { username: 123, email: 'test@example.com', password: 'Password123' },
        { username: true, email: 'test@example.com', password: 'Password123' },
        { username: [], email: 'test@example.com', password: 'Password123' },
        { username: null, email: 'test@example.com', password: 'Password123' },
      ];

      for (const payload of confusionPayloads) {
        const response = await request.post('http://localhost:3457/auth.signup', {
          headers: { 'Content-Type': 'application/json' },
          data: payload,
        });

        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });
  });
});
