import type { Page } from '@playwright/test';
import { test, expect, CHURCH_WITH_DETAILS, firstPageUrl } from './fixtures.js';
import { churchNameId } from '../src/churches/list/church-list-ids';
import { DIRECTORY_API_PREFIX, SearchParamNames } from '../src/shared/directory-api';

function recordDirectoryRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on('request', request => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith(DIRECTORY_API_PREFIX)) {
      requested.push(pathname);
    }
  });
  return requested;
}

async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll('[ngh]').length === 0);
}

test.describe('TransferCache', () => {
  test('hydrating a server-rendered list reuses the server response instead of asking the directory again', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    const directoryRequests = recordDirectoryRequests(page);

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }), {
      waitUntil: 'domcontentloaded',
    });
    await waitForHydration(page);

    expect(directoryRequests).toEqual([]);
  });

  test('a client-side navigation after hydration still asks the directory', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }), {
      waitUntil: 'domcontentloaded',
    });
    await waitForHydration(page);
    const directoryRequests = recordDirectoryRequests(page);

    await page.locator(`#${churchNameId(0)}`).click();
    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', CHURCH_WITH_DETAILS.id);

    expect(directoryRequests).not.toEqual([]);
  });
});
