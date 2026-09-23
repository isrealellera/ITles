import { defineConfig, devices } from '@playwright/test';

const PORT = 8799;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `rm -rf .data/e2e && npx tsx dev/server.ts`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT), DATABASE_URL: 'pglite:.data/e2e', SETUP_KEY: 'ui-e2e-setup-key' },
  },
});
