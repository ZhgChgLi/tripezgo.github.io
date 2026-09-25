import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:' + PORT,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://localhost:' + PORT + '/trip/',
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
