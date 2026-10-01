import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const BROWSER_SPECS = 'src/**/*.browser.spec.ts';

export default defineConfig({
  test: {
    globals: true,
    bail: 1,
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov', 'text'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/test-setup.ts',
        'src/test-setup.browser.ts',
        'src/test-setup-resources.browser.ts',
        'src/main.ts',
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          pool: 'threads',
          fileParallelism: false,
          environment: 'jsdom',
          setupFiles: ['src/test-setup.ts'],
          include: ['src/**/*.spec.ts'],
          exclude: ['**/node_modules/**', '**/e2e/**', BROWSER_SPECS],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          fileParallelism: false,
          setupFiles: ['src/test-setup.browser.ts'],
          include: [BROWSER_SPECS],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
