import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3456',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          slowMo: process.env.SLOW ? 500 : 0,
        },
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm tsx e2e/server/index.ts',
      url: 'http://localhost:3457',
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm vite --config e2e/app/vite.config.ts',
      url: 'http://localhost:3456',
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
