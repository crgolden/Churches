import { createBdd, test as base } from 'playwright-bdd';
import { answerMapTilesWithNoContent } from '../map-tiles.js';
import { createTestStore, type TestStore } from '../test-data.js';
import { DIRECTORY_API_PREFIX } from '../../src/shared/directory-api';
import { ScenarioContext } from './scenario-context.js';

export const test = base.extend<{ store: TestStore; ctx: ScenarioContext }>({
  store: async ({}, use) => {
    const store = createTestStore();
    await store.reset();
    await use(store);
  },
  ctx: async ({ page }, use) => {
    const ctx = new ScenarioContext();
    await answerMapTilesWithNoContent(page);
    page.on('console', message => {
      if (message.type() === 'error') {
        ctx.scriptErrors.push(message.text());
      }
    });
    page.on('request', request => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith(DIRECTORY_API_PREFIX)) {
        ctx.directoryRequests.push(pathname);
      }
    });
    await use(ctx);
  },
});

export const { Given, When, Then } = createBdd(test);
