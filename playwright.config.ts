import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './config/urls';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ['html', { open: process.env.CI ? 'never' : 'always', outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? 'on' : 'on-first-retry',
    screenshot: 'on',
    video: process.env.CI ? 'on' : 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
