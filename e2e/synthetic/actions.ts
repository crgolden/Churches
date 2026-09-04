import { hasPrefix, isVisible, pickFromPrefix, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect, type Locator, type Page } from '@playwright/test';

const SEARCH_KEYWORDS = ['grace', 'first', 'community', 'hope', 'faith', 'trinity', 'christ', 'saint'] as const;
const SEARCH_STATES = ['TX', 'CA', 'FL', 'OH', 'GA', 'NC', 'PA', 'WA'] as const;
const RENDER_TIMEOUT_MS = 30_000;

async function expectRendered(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
}

async function expectResultsRendered(page: Page): Promise<void> {
  await expectRendered(page.locator('#result-count'));
}

export const churchesActions: readonly WalkerAction[] = [
  {
    name: 'go home',
    weight: 2,
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto('/');
      await expectRendered(page.locator('#search-title'));
    },
  },
  {
    name: 'search by keyword',
    weight: 5,
    available: page => isVisible(page, '#search-keyword'),
    run: async (page, rng) => {
      await page.fill('#search-keyword', rng.pick(SEARCH_KEYWORDS));
      await page.click('#btn-search');
      await page.waitForURL('**/churches**');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'search by state',
    weight: 3,
    available: page => isVisible(page, '#search-state'),
    run: async (page, rng) => {
      await page.fill('#search-state', rng.pick(SEARCH_STATES));
      await page.click('#btn-search');
      await page.waitForURL('**/churches**');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'search by worship style',
    weight: 2,
    available: page => isVisible(page, '#search-worship-style'),
    run: async (page, rng) => {
      const options = page.locator('#search-worship-style option');
      const optionCount = await options.count();
      await page.selectOption('#search-worship-style', { index: rng.int(optionCount) });
      await page.click('#btn-search');
      await page.waitForURL('**/churches**');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'open a result',
    weight: 5,
    available: page => hasPrefix(page, 'church-name-'),
    run: async (page, rng) => {
      const result = await pickFromPrefix(page, rng, 'church-name-');
      await result.click();
      await expectRendered(page.locator('#church-name'));
    },
  },
  {
    name: 'next page of results',
    weight: 2,
    available: async page => (await isVisible(page, '#btn-next-page')) && (await page.locator('#btn-next-page').isEnabled()),
    run: async page => {
      await page.click('#btn-next-page');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'previous page of results',
    weight: 1,
    available: async page => (await isVisible(page, '#btn-prev-page')) && (await page.locator('#btn-prev-page').isEnabled()),
    run: async page => {
      await page.click('#btn-prev-page');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'toggle map view',
    weight: 2,
    available: page => isVisible(page, '#btn-view-map'),
    run: async page => {
      await page.click('#btn-view-map');
      await expectRendered(page.locator('#church-map'));
      await page.click('#btn-view-list');
    },
  },
  {
    name: 'view contribute form',
    weight: 1,
    available: page => isVisible(page, '#contribute-link'),
    run: async page => {
      await page.click('#contribute-link');
      await expectRendered(page.locator('#contribute-title'));
      await page.goBack();
      await expectRendered(page.locator('#church-name'));
    },
  },
  {
    name: 'scroll the detail page to its map',
    weight: 2,
    available: page => isVisible(page, '#church-map-section'),
    run: async page => {
      await page.locator('#church-map-section').scrollIntoViewIfNeeded();
      await expectRendered(page.locator('#church-name'));
    },
  },
];
