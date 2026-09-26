import type { Page } from '@playwright/test';
import { newText, randomIntBetween } from '@crgolden/modules/testing';
import {
  test,
  expect,
  CHURCH_WITH_DETAILS,
  churchesUrl,
  firstPageUrl,
  newChurchWithoutDetails,
  seedChurches,
} from './fixtures.js';
import { AngularSsrMarkers } from './angular-ssr-constants.js';
import e2eSettings from './e2e-settings.json';
import { expectLeafletStylesheetApplied, expectTileLayerMounted } from './map-assertions.js';
import { CHURCHES_URL, churchUrl } from '../src/app/app-paths';
import { CHURCH_MAP_ID, CHURCH_MAP_TILES_ID } from '../src/churches/map/map-ids';
import { CHURCH_DISTANCE_ID_PREFIX, churchNameId } from '../src/churches/list/church-list-ids';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../src/shared/directory-api';
import { ScrollRestorationModes } from '@crgolden/modules/scroll-restoration';
import {
  CANONICAL_REL,
  JSON_LD_MIME_TYPE,
  MetaNames,
  MetaProperties,
  SchemaTypes,
} from '../src/shared/seo-contract';

const SCROLL_RESTORE_TOLERANCE_PX = e2eSettings.scrollRestoreTolerancePx;

function clickWithoutScrollingTheTargetIntoView(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    document.querySelector<HTMLElement>(sel)?.click();
    return window.scrollY;
  }, selector);
}

async function waitForTheRouterToOwnScrollRestoration(page: Page): Promise<void> {
  await page.waitForFunction(
    (routerOwned) => window.history.scrollRestoration === routerOwned,
    ScrollRestorationModes.manual,
  );
}

function newCountSpanningTwoPages(): number {
  return DEFAULT_PAGE_SIZE + randomIntBetween(1, DEFAULT_PAGE_SIZE);
}

test.describe('SSR — raw HTML assertions', () => {
  test('churches list page is server-rendered with SEO tags', async ({ request, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    const res = await request.get(churchesUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }));
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toMatch(/<title[^>]*>/);
    expect(html).toContain(MetaProperties.ogTitle);
    expect(html).toContain(MetaNames.twitterCard);
  });

  test('church detail page is server-rendered with full SEO', async ({ request, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    const res = await request.get(churchUrl(CHURCH_WITH_DETAILS.slug));
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(`data-church-id="${CHURCH_WITH_DETAILS.id}"`);
    expect(html).toMatch(/<title[^>]*>[^<]*\S[^<]*<\/title>/);
    expect(html).toContain(`name="${MetaNames.description}"`);
    expect(html).toContain(`rel="${CANONICAL_REL}"`);
    expect(html).toContain(MetaProperties.ogTitle);
    expect(html).toContain(MetaProperties.ogDescription);
    expect(html).toContain(MetaProperties.ogUrl);
    expect(html).toContain(MetaNames.twitterCard);
    expect(html).toContain(JSON_LD_MIME_TYPE);
    expect(html).toContain(`"${SchemaTypes.church}"`);
  });
});

test.describe('HomePage', () => {
  test('on load, shows search form and heading', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');
    await expect(page.locator('#search-title')).toBeVisible();
    await expect(page.locator('#search-keyword')).toBeVisible();
    await expect(page.locator('#btn-search')).toBeVisible();
  });
});

test.describe('SearchForm', () => {
  test('with keyword, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');
    await page.locator('#search-keyword').fill(CHURCH_WITH_DETAILS.canonicalName);
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    await expect(page.locator(`#${churchNameId(0)}`)).toHaveAttribute('href', churchUrl(CHURCH_WITH_DETAILS.slug));
  });

  test('with state filter, shows matching churches', async ({ anonymousPage: page, store }) => {
    const neighbour = { ...newChurchWithoutDetails(), state: CHURCH_WITH_DETAILS.state };
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    await store.seedChurch(neighbour);

    await page.goto('/');
    await page.locator('#search-state').fill(CHURCH_WITH_DETAILS.state);
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String([CHURCH_WITH_DETAILS, neighbour].length));
    await expect(page.locator('#church-location-0')).toBeVisible();
  });

  test('with worship style filter, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');
    await page.locator('#search-worship-style').selectOption(String(CHURCH_WITH_DETAILS.worshipStyle));
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain(CHURCHES_URL);
  });

  test('with wheelchair filter, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');
    await page.locator('#search-wheelchair').check();
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain(CHURCHES_URL);
  });

  test('with no matching keyword, shows zero results', async ({ anonymousPage: page, store }) => {
    const unmatchedKeyword = newText();
    await store.reset();

    await page.goto('/');
    await page.locator('#search-keyword').fill(unmatchedKeyword);
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String(0));
  });

  test('when Enter key pressed, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');
    const input = page.locator('#search-keyword');
    await input.fill(CHURCH_WITH_DETAILS.canonicalName);
    await input.press('Enter');
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain(CHURCHES_URL);
  });

  test('Near Me button click produces no console errors', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({
      latitude: CHURCH_WITH_DETAILS.latitude,
      longitude: CHURCH_WITH_DETAILS.longitude,
    });

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.locator('#btn-near-me').click();
    await expect(page.locator('#location-note')).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});

test.describe('ChurchList', () => {
  test('with results, displays result count', async ({ anonymousPage: page, store }) => {
    const sameCity = { ...newChurchWithoutDetails(), city: CHURCH_WITH_DETAILS.city };
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    await store.seedChurch(sameCity);

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.city }));
    await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String([CHURCH_WITH_DETAILS, sameCity].length));
  });

  test('each card shows name link and location', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }));
    await expect(page.locator(`#${churchNameId(0)}`)).toHaveAttribute('href', churchUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page.locator('#church-location-0')).toBeVisible();
  });

  test('without geolocation, omits distance column', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }));
    await expect(page.locator(`#${churchNameId(0)}`)).toBeVisible();
    await expect(page.locator(`[id^="${CHURCH_DISTANCE_ID_PREFIX}"]`)).toHaveCount(0);
  });

  test('when more results than page size, shows Next button', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await seedChurches(store, newCountSpanningTwoPages());

    await page.goto(firstPageUrl());
    await expect(page.locator('#btn-next-page')).toBeVisible();
    await expect(page.locator('#btn-prev-page')).toHaveCount(0);
  });

  test('on final page, shows Previous button only', async ({ anonymousPage: page, store }) => {
    const churchCount = newCountSpanningTwoPages();
    const finalPage = Math.ceil(churchCount / DEFAULT_PAGE_SIZE);
    await store.reset();
    await seedChurches(store, churchCount);

    await page.goto(churchesUrl({
      [SearchParamNames.page]: String(finalPage),
      [SearchParamNames.pageSize]: String(DEFAULT_PAGE_SIZE),
    }));
    await expect(page.locator('#btn-prev-page')).toBeVisible();
    await expect(page.locator('#btn-next-page')).toHaveCount(0);
  });

  test('toggling map view renders Leaflet map with markers and CSS applied', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }));
    await page.locator('#btn-view-map').click();
    await expect(page.locator(`#${CHURCH_MAP_ID}`)).toBeVisible();
    await expect(page.locator(`#church-marker-${CHURCH_WITH_DETAILS.slug}`)).toBeVisible();
    await expectTileLayerMounted(page, CHURCH_MAP_TILES_ID);
    await expectLeafletStylesheetApplied(page, CHURCH_MAP_ID, CHURCH_MAP_TILES_ID);
  });

  test('clicking church name navigates to detail page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }));
    await page.locator(`#${churchNameId(0)}`).click();
    await page.waitForURL(`**${churchUrl(CHURCH_WITH_DETAILS.slug)}**`);
    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', CHURCH_WITH_DETAILS.id);
  });

  test('paging forward scrolls to the top of the new page', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await seedChurches(store, newCountSpanningTwoPages());

    await page.goto(firstPageUrl());
    await expect(page.locator('#btn-next-page')).toBeEnabled();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.locator('#btn-next-page').click();
    await page.waitForURL('**page=2**');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('going back restores the reader position', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await seedChurches(store, newCountSpanningTwoPages());

    await page.goto(firstPageUrl());
    await waitForTheRouterToOwnScrollRestoration(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const readerPosition = await page.evaluate(() => window.scrollY);

    const positionAtNavigation = await clickWithoutScrollingTheTargetIntoView(page, '#btn-next-page');
    expect(positionAtNavigation).toBe(readerPosition);

    await page.waitForURL('**page=2**');

    await page.goBack();
    await page.waitForURL('**page=1**');
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThanOrEqual(readerPosition - SCROLL_RESTORE_TOLERANCE_PX);
  });

  test('going back after leaving the document restores the reader position', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await seedChurches(store, newCountSpanningTwoPages());

    await page.goto(firstPageUrl());
    await waitForTheRouterToOwnScrollRestoration(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const readerPosition = await page.evaluate(() => window.scrollY);
    const nextPageHref = await page.locator('#btn-next-page').getAttribute('href');
    if (nextPageHref === null) {
      throw new Error('#btn-next-page carries no href, so there is no document to leave for');
    }

    await page.goto(nextPageHref);
    await page.waitForURL('**page=2**');

    await page.goBack();
    await page.waitForURL('**page=1**');
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThanOrEqual(readerPosition - SCROLL_RESTORE_TOLERANCE_PX);
  });
});
