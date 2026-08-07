import { defineConfig, devices } from '@playwright/test';

const SSR_PORT = 4000;
const MOCK_DIR_PORT = 4001;

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',

  outputDir: './playwright-artifacts',

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'playwright-results.xml' }],
  ],

  use: {
    baseURL: `http://localhost:${SSR_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'e2e',
      testMatch: /.*\/e2e\/(?!smoke\/).*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: smokeBaseUrl ?? `http://localhost:${SSR_PORT}`,
      },
    },
  ],

  webServer: smokeBaseUrl ? undefined : [
    {
      command: 'npx tsx e2e/mocks/directory-server.ts',
      port: MOCK_DIR_PORT,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
    {
      command: 'node --import ./instrumentation.mjs dist/churches.client/server/server.mjs',
      port: SSR_PORT,
      env: {
        PORT: String(SSR_PORT),
        DirectoryApiAddress: `http://localhost:${MOCK_DIR_PORT}`,
        SessionStore: 'memory',
        NODE_ENV: 'test',
        ChurchesClientId: 'e2e-client-id',
        ChurchesClientSecret: 'e2e-secret',
        OidcAuthority: 'http://localhost:4002',
        SessionSecret: 'e2e-test-secret-must-be-at-least-32-chars',
      },
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
  ],
});
