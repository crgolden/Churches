import { hasPrefix, isVisible, pickFromPrefix, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect, type Locator, type Page } from '@playwright/test';
import walkerSettings from './walker-settings.json';
import { US_STATES } from '../../src/shared/models';
import { CHURCH_MAP_ID } from '../../src/churches/map/map-ids';
import { CHURCH_NAME_ID_PREFIX } from '../../src/churches/list/church-list-ids';

const SEARCH_STATES = US_STATES.map(state => state.code);

const ACTION_WEIGHTS: Readonly<Record<string, number | undefined>> = walkerSettings.actionWeights;

function weightOf(actionName: string): number {
  const weight = ACTION_WEIGHTS[actionName];
  if (weight === undefined) {
    throw new Error(`walker-settings.json names no weight for the '${actionName}' action.`);
  }
  return weight;
}

async function expectRendered(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
}

async function expectResultsRendered(page: Page): Promise<void> {
  await expectRendered(page.locator('#result-count'));
}

const unweightedActions: readonly Omit<WalkerAction, 'weight'>[] = [
  {
    name: 'go home',
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto('/');
      await expectRendered(page.locator('#search-title'));
    },
  },
  {
    name: 'search by keyword',
    available: page => isVisible(page, '#search-keyword'),
    run: async (page, rng) => {
      await page.fill('#search-keyword', rng.pick(walkerSettings.searchKeywords));
      await page.click('#btn-search');
      await page.waitForURL('**/churches**');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'search by state',
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
    available: page => isVisible(page, '#search-worship-style'),
    run: async (page, rng) => {
      const options = page.locator('#search-worship-style option');
      await options.first().waitFor();
      const optionCount = await options.count();
      await page.selectOption('#search-worship-style', { index: rng.int(optionCount) });
      await page.click('#btn-search');
      await page.waitForURL('**/churches**');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'open a result',
    available: page => hasPrefix(page, CHURCH_NAME_ID_PREFIX),
    run: async (page, rng) => {
      const result = await pickFromPrefix(page, rng, CHURCH_NAME_ID_PREFIX);
      await result.click();
      await expectRendered(page.locator('#church-name'));
    },
  },
  {
    name: 'next page of results',
    available: page => isVisible(page, '#btn-next-page'),
    run: async page => {
      await page.click('#btn-next-page');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'previous page of results',
    available: page => isVisible(page, '#btn-prev-page'),
    run: async page => {
      await page.click('#btn-prev-page');
      await expectResultsRendered(page);
    },
  },
  {
    name: 'toggle map view',
    available: page => isVisible(page, '#btn-view-map'),
    run: async page => {
      await page.click('#btn-view-map');
      await expectRendered(page.locator(`#${CHURCH_MAP_ID}`));
      await page.click('#btn-view-list');
    },
  },
  {
    name: 'view contribute form',
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
    available: page => isVisible(page, '#church-map-section'),
    run: async page => {
      await page.locator('#church-map-section').scrollIntoViewIfNeeded();
      await expectRendered(page.locator('#church-name'));
    },
  },
];

export const churchesActions: readonly WalkerAction[] = unweightedActions.map(action => ({
  ...action,
  weight: weightOf(action.name),
}));
