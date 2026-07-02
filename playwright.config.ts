import { defineConfig, devices } from '@playwright/test';

const SSR_PORT = 4000;
const MOCK_DIR_PORT = 4001;

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

export default defineConfig({
  // E2E specs live in e2e/; smoke specs live in e2e/smoke/.
  testDir: './e2e',

  // Artifacts go here on failure (mirrors PlaywrightArtifactRecorder behaviour).
  outputDir: './playwright-artifacts',

  // Reporters: HTML report + list for CI stdout + JUnit for ADO/App Insights publishing.
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'playwright-results.xml' }],
  ],

  use: {
    // Default base URL points at the local SSR server; smoke tests override via project.
    baseURL: `http://localhost:${SSR_PORT}`,
    // Retain trace / screenshot / video only on failure — mirrors C# recorder.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // The Node SSR server does not use HTTPS locally.
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'e2e',
      // All specs outside smoke/.
      testMatch: /.*\/e2e\/(?!smoke\/).*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      // Serialise to match the C# xUnit Collection behaviour (tests share state
      // via the mock server; parallel execution causes interference).
      fullyParallel: false,
      // Force a single worker so that tests from different spec files never
      // run concurrently — they would race on the shared mock server state.
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

  // ── Web servers ─────────────────────────────────────────────────────────────
  // Playwright manages both servers during the test run.  The mock directory
  // server must be up before the SSR server starts (SSR's warmup request hits
  // it during Angular bootstrap).
  // When SmokeBaseUrl is set (post-deploy smoke against a real deployed instance),
  // skip starting any local server entirely — there is nothing to build/run locally,
  // and the post-deploy CI job never runs `npm run build` before this config loads.
  webServer: smokeBaseUrl ? undefined : [
    {
      // Mock Directory API — handles /directory/api/* routes and /_test/* control API.
      command: 'npx tsx e2e/mocks/directory-server.ts',
      port: MOCK_DIR_PORT,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
    {
      // Node SSR + BFF server — built output (npm run build -- --configuration=ci first).
      command: 'node --import ./instrumentation.mjs dist/churches.client/server/server.mjs',
      port: SSR_PORT,
      env: {
        PORT: String(SSR_PORT),
        // Point the BFF proxy at the mock Directory API.
        DirectoryApiAddress: `http://localhost:${MOCK_DIR_PORT}`,
        // Use in-memory session store — no Redis required for tests.
        SessionStore: 'memory',
        NODE_ENV: 'test',
        // Dummy OIDC values — discovery is lazy and never called in E2E tests
        // because /bff/login is mocked at the Playwright route level.
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
