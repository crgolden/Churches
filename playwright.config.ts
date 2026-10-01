import { defineConfig, devices } from '@playwright/test';
import { newId, newText } from '@crgolden/modules/testing';
import { cucumberReporter, defineBddProject } from 'playwright-bdd';
import { MEMORY_SESSION_STORE } from './src/bff/settings';
import { CucumberReporterTypes } from './e2e/cucumber-constants';
import { E2E_CONTRACT_VARIABLE, newE2eContract } from './e2e/mocks/e2e-contract';
import e2eSettings from './e2e/e2e-settings.json';

const SSR_PORT = e2eSettings.ports.ssr;
const MOCK_DIR_PORT = e2eSettings.ports.mockDirectory;

process.env[E2E_CONTRACT_VARIABLE] ??= JSON.stringify(newE2eContract(MOCK_DIR_PORT));

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',

  outputDir: './playwright-artifacts',

  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'playwright-results.xml' }],
    cucumberReporter(CucumberReporterTypes.message, { outputFile: e2eSettings.cucumberMessagesFile }),
    cucumberReporter(CucumberReporterTypes.html, { outputFile: e2eSettings.cucumberHtmlFile }),
  ],

  use: {
    baseURL: `http://localhost:${SSR_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'integration',
      testDir: './integration',
      fullyParallel: false,
      workers: 1,
    },
    {
      ...defineBddProject({ name: 'e2e', features: e2eSettings.bddFeatures, steps: e2eSettings.bddSteps }),
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'synthetic',
      testDir: './e2e/synthetic',
      timeout: 10 * 60_000,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: walkerBaseUrl ?? `http://localhost:${SSR_PORT}`,
        userAgent: `${devices['Desktop Chrome'].userAgent} crgolden-synthetic/1.0`,
      },
    },
  ],

  webServer: walkerBaseUrl ? undefined : [
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
        SitemapBlobBaseUrl: `http://localhost:${MOCK_DIR_PORT}/`,
        SessionStore: MEMORY_SESSION_STORE,
        NODE_ENV: 'test',
        ChurchesClientId: newText(),
        ChurchesClientSecret: newText(),
        OidcAuthority: `http://localhost:${e2eSettings.ports.unusedOidcAuthority}`,
        SessionSecret: `${newId()}${newId()}`,
      },
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
  ],
});
