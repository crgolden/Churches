import { expect, type Page } from '@playwright/test';
import { randomIntBetween } from '@crgolden/modules/testing';
import { ScrollRestorationModes } from '@crgolden/modules/scroll-restoration';
import e2eSettings from '../e2e-settings.json';
import { expectLeafletStylesheetApplied, expectTileLayerMounted } from '../map-assertions.js';
import { firstPageUrl, newChurchWithoutDetails, seedChurches } from '../test-data.js';
import { churchUrl } from '../../src/app/app-paths';
import { CHURCH_DISTANCE_ID_PREFIX, churchNameId } from '../../src/churches/list/church-list-ids';
import { CHURCH_MAP_ID, CHURCH_MAP_TILES_ID } from '../../src/churches/map/map-ids';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../../src/shared/directory-api';
import { Given, Then, When } from './fixtures.js';

const SCROLL_RESTORE_TOLERANCE_PX = e2eSettings.scrollRestoreTolerancePx;
const FIRST_PAGE = `**${SearchParamNames.page}=1**`;
const SECOND_PAGE = `**${SearchParamNames.page}=2**`;

function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}

function clickWithoutScrollingTheTargetIntoView(page: Page, selector: string): Promise<number> {
  return page.evaluate(sel => {
    document.querySelector<HTMLElement>(sel)?.click();
    return window.scrollY;
  }, selector);
}

async function lookForTheChurchByName(page: Page, name: string): Promise<void> {
  await page.goto(firstPageUrl({ [SearchParamNames.q]: name }));
}

Given('two churches are listed in the same city', async ({ store, ctx }) => {
  ctx.church = newChurchWithoutDetails();
  ctx.neighbours = [{ ...newChurchWithoutDetails(), city: ctx.church.city }];
  await store.seedChurch(ctx.church);
  await store.seedChurch(ctx.neighbours[0]);
});

Given('more churches are listed than fit on one page', async ({ store }) => {
  await seedChurches(store, DEFAULT_PAGE_SIZE + randomIntBetween(1, DEFAULT_PAGE_SIZE));
});

Given('I have scrolled to the bottom of the first page', async ({ page, ctx }) => {
  await page.goto(firstPageUrl());
  await expect(page.locator('#btn-next-page')).toBeEnabled();
  await page.waitForFunction(routerOwned => window.history.scrollRestoration === routerOwned, ScrollRestorationModes.manual);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  ctx.readerPosition = await scrollY(page);
});

Given('I have looked for that church by name', async ({ page, ctx }) => {
  await lookForTheChurchByName(page, ctx.church.canonicalName);
});

When('I look for that church by name', async ({ page, ctx }) => {
  await lookForTheChurchByName(page, ctx.church.canonicalName);
});

When('I look for churches in that city', async ({ page, ctx }) => {
  await page.goto(firstPageUrl({ [SearchParamNames.q]: ctx.church.city }));
});

When('I view the results on a map', async ({ page }) => {
  await page.locator('#btn-view-map').click();
});

When('I open that church from the results', async ({ page, ctx }) => {
  await page.locator(`#${churchNameId(0)}`).click();
  await page.waitForURL(`**${churchUrl(ctx.church.slug)}**`);
});

When('I turn to the next page', async ({ page }) => {
  await page.locator('#btn-next-page').click();
  await page.waitForURL(SECOND_PAGE);
});

When('I turn to the next page and go back', async ({ page, ctx }) => {
  const positionAtNavigation = await clickWithoutScrollingTheTargetIntoView(page, '#btn-next-page');
  expect(positionAtNavigation, 'the click moved the page, so this scenario would measure the driver').toBe(ctx.readerPosition);
  await page.waitForURL(SECOND_PAGE);
  await page.goBack();
  await page.waitForURL(FIRST_PAGE);
});

When('I load the next page directly and go back', async ({ page }) => {
  const nextPageHref = await page.locator('#btn-next-page').getAttribute('href');
  if (nextPageHref === null) {
    throw new Error('#btn-next-page carries no href, so there is no document to leave for');
  }
  await page.goto(nextPageHref);
  await page.waitForURL(SECOND_PAGE);
  await page.goBack();
  await page.waitForURL(FIRST_PAGE);
});

Then('I am told two churches matched', async ({ page, ctx }) => {
  await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String([ctx.church, ...ctx.neighbours].length));
});

Then("that church's result links to its page", async ({ page, ctx }) => {
  await expect(page.locator(`#${churchNameId(0)}`)).toHaveAttribute('href', churchUrl(ctx.church.slug));
});

Then("that church's result says where it is", async ({ page }) => {
  await expect(page.locator('#church-location-0')).toBeVisible();
});

Then('the results show no distances', async ({ page }) => {
  await expect(page.locator(`#${churchNameId(0)}`)).toBeVisible();
  await expect(page.locator(`[id^="${CHURCH_DISTANCE_ID_PREFIX}"]`)).toHaveCount(0);
});

Then('I see that church on the map', async ({ page, ctx }) => {
  await expect(page.locator(`#${CHURCH_MAP_ID}`)).toBeVisible();
  await expect(page.locator(`#church-marker-${ctx.church.slug}`)).toBeVisible();
  await expectTileLayerMounted(page, CHURCH_MAP_TILES_ID);
  await expectLeafletStylesheetApplied(page, CHURCH_MAP_ID, CHURCH_MAP_TILES_ID);
});

Then('I am at the top of the next page', async ({ page }) => {
  await expect.poll(() => scrollY(page)).toBe(0);
});

Then('I am where I was on the first page', async ({ page, ctx }) => {
  await expect.poll(() => scrollY(page)).toBeGreaterThanOrEqual(ctx.readerPosition - SCROLL_RESTORE_TOLERANCE_PX);
});
