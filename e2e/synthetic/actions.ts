import { hasPrefix, isVisible, pickFromPrefix, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect } from '@playwright/test';

const SEARCH_KEYWORDS = ['grace', 'first', 'community', 'hope', 'faith', 'trinity', 'christ', 'saint'] as const;
const SEARCH_STATES = ['TX', 'CA', 'FL', 'OH', 'GA', 'NC', 'PA', 'WA'] as const;

export const churchesActions: readonly WalkerAction[] = [
  {
    name: 'go home',
    weight: 2,
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto('/');
      await expect(page.locator('#search-title')).toBeVisible();
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
      await expect(page.locator('#result-count')).toBeVisible();
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
      await expect(page.locator('#result-count')).toBeVisible();
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
      await expect(page.locator('#result-count')).toBeVisible();
    },
  },
  {
    name: 'open a result',
    weight: 5,
    available: page => hasPrefix(page, 'church-name-'),
    run: async (page, rng) => {
      const result = await pickFromPrefix(page, rng, 'church-name-');
      await result.click();
      await expect(page.locator('#church-name')).toBeVisible();
    },
  },
  {
    name: 'next page of results',
    weight: 2,
    available: async page => (await isVisible(page, '#btn-next-page')) && (await page.locator('#btn-next-page').isEnabled()),
    run: async page => {
      await page.click('#btn-next-page');
      await expect(page.locator('#result-count')).toBeVisible();
    },
  },
  {
    name: 'previous page of results',
    weight: 1,
    available: async page => (await isVisible(page, '#btn-prev-page')) && (await page.locator('#btn-prev-page').isEnabled()),
    run: async page => {
      await page.click('#btn-prev-page');
      await expect(page.locator('#result-count')).toBeVisible();
    },
  },
  {
    name: 'toggle map view',
    weight: 2,
    available: page => isVisible(page, '#btn-view-map'),
    run: async page => {
      await page.click('#btn-view-map');
      await expect(page.locator('#church-map')).toBeVisible();
      await page.click('#btn-view-list');
    },
  },
  {
    name: 'view contribute form',
    weight: 1,
    available: page => isVisible(page, '#contribute-link'),
    run: async page => {
      await page.click('#contribute-link');
      await expect(page.locator('#contribute-title')).toBeVisible();
      await page.goBack();
      await expect(page.locator('#church-name')).toBeVisible();
    },
  },
  {
    name: 'scroll the detail page',
    weight: 2,
    available: page => isVisible(page, '#church-name'),
    run: async page => {
      await page.locator('#church-map-section').scrollIntoViewIfNeeded();
      await expect(page.locator('#church-name')).toBeVisible();
    },
  },
];
