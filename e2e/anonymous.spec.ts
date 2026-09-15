import type { Page } from '@playwright/test';
import { test, expect, FIRST_BAPTIST_AUSTIN, MOSAIC_AUSTIN } from './fixtures.js';
import type { ChurchRecord } from './fixtures.js';
import { expectLeafletStylesheetApplied, expectTileLayerMounted } from './map-assertions.js';

const SCROLL_RESTORE_TOLERANCE_PX = 40;

function clickWithoutScrollingTheTargetIntoView(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    document.querySelector<HTMLElement>(sel)?.click();
    return window.scrollY;
  }, selector);
}

function churchNumbered(index: number): ChurchRecord {
  const padded = String(index).padStart(3, '0');
  return {
    id: crypto.randomUUID(),
    canonicalName: `Church ${padded}`,
    slug: `church-${padded}-city-tx`,
    latitude: 30.0,
    longitude: -97.0,
    street: null,
    city: 'City',
    state: 'TX',
    zip: '78700',
    phoneNumber: null,
    website: null,
    emailAddress: null,
    denominationId: null,
    worshipStyle: 1,
    primaryLanguage: 'English',
    acceptsLGBTQ: null,
    wheelchairAccessible: null,
    hasNursery: null,
    hasYouthProgram: null,
    confidenceScore: 0.5,
    lastVerifiedAt: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schedules: [],
    ministries: [],
    campuses: [],
  };
}

test.describe('SSR — raw HTML assertions', () => {
  test('churches list page is server-rendered with SEO tags', async ({ request, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const res = await request.get('/churches?q=Baptist');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain('ng-server-context');
    expect(html).toMatch(/<title[^>]*>/);
    expect(html).toContain('og:title');
    expect(html).toContain('twitter:card');
  });

  test('church detail page is server-rendered with full SEO', async ({ request, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const res = await request.get('/churches/first-baptist-church-austin-tx');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain('ng-server-context');
    expect(html).toContain('First Baptist Church Austin');
    expect(html).toMatch(/<title[^>]*>First Baptist Church Austin/);
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:url');
    expect(html).toContain('twitter:card');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"Church"');
  });
});

test.describe('HomePage', () => {
  test('on load, shows search form and heading', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await expect(page.locator('#search-title')).toContainText('Find Your Church Home');
    await expect(page.locator('#search-keyword')).toBeVisible();
    await expect(page.locator('#btn-search')).toBeVisible();
  });
});

test.describe('SearchForm', () => {
  test('with keyword, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await page.locator('#search-keyword').fill('Baptist');
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('#church-name-0')).toContainText('First Baptist Church Austin');
  });

  test('with state filter, shows matching churches', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await store.seedChurch(MOSAIC_AUSTIN);

    await page.goto('/');
    await page.locator('#search-state').fill('TX');
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('#church-location-0')).toContainText('Austin, TX');
  });

  test('with worship style filter, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await page.locator('#search-worship-style').selectOption('1');
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain('/churches');
  });

  test('with wheelchair filter, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await page.locator("input[type='checkbox']").check();
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain('/churches');
  });

  test('with no matching keyword, shows zero results', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('#search-keyword').fill('zzz_no_match_zzz');
    await page.locator('#btn-search').click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('#result-count')).toContainText('0 churches found');
  });

  test('when Enter key pressed, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    const input = page.locator('#search-keyword');
    await input.fill('Baptist');
    await input.press('Enter');
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain('/churches');
  });

  test('Near Me button click produces no console errors', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({
      latitude: FIRST_BAPTIST_AUSTIN.latitude,
      longitude: FIRST_BAPTIST_AUSTIN.longitude,
    });

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.locator('#btn-near-me').click();
    await expect(page.locator('#location-note')).toBeVisible();

    const unexpected = errors.filter(e => !e.includes('/bff/user') && !e.includes('401'));
    expect(unexpected).toHaveLength(0);
  });
});

test.describe('ChurchList', () => {
  test('with results, displays result count', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await store.seedChurch(MOSAIC_AUSTIN);

    await page.goto('/churches?q=Austin&page=1&pageSize=20');
    await expect(page.locator('#result-count')).toContainText('churches found');
  });

  test('each card shows name link and location', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await expect(page.locator('#church-name-0')).toContainText('First Baptist Church Austin');
    await expect(page.locator('#church-location-0')).toContainText('Austin, TX');
  });

  test('without geolocation, omits distance column', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await expect(page.locator('[id^="church-distance-"]')).toHaveCount(0);
  });

  test('when more results than page size, shows Next button', async ({ anonymousPage: page, store }) => {
    await store.reset();
    for (let i = 0; i < 25; i++) {
      const church: ChurchRecord = {
        id: crypto.randomUUID(),
        canonicalName: `Church ${String(i).padStart(3, '0')}`,
        slug: `church-${String(i).padStart(3, '0')}-city-tx`,
        latitude: 30.0,
        longitude: -97.0,
        street: null,
        city: 'City',
        state: 'TX',
        zip: '78700',
        phoneNumber: null,
        website: null,
        emailAddress: null,
        denominationId: null,
        worshipStyle: 1,
        primaryLanguage: 'English',
        acceptsLGBTQ: null,
        wheelchairAccessible: null,
        hasNursery: null,
        hasYouthProgram: null,
        confidenceScore: 0.5,
        lastVerifiedAt: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schedules: [],
        ministries: [],
        campuses: [],
      };
      await store.seedChurch(church);
    }

    await page.goto('/churches?q=Church&page=1&pageSize=20');
    await expect(page.locator('#btn-next-page')).toBeEnabled();
    await expect(page.locator('#btn-prev-page')).toBeDisabled();
  });

  test('on final page, shows Previous button only', async ({ anonymousPage: page, store }) => {
    await store.reset();
    for (let i = 0; i < 25; i++) {
      const church: ChurchRecord = {
        id: crypto.randomUUID(),
        canonicalName: `Church ${String(i).padStart(3, '0')}`,
        slug: `church-${String(i).padStart(3, '0')}-city-tx`,
        latitude: 30.0,
        longitude: -97.0,
        street: null,
        city: 'City',
        state: 'TX',
        zip: '78700',
        phoneNumber: null,
        website: null,
        emailAddress: null,
        denominationId: null,
        worshipStyle: 1,
        primaryLanguage: 'English',
        acceptsLGBTQ: null,
        wheelchairAccessible: null,
        hasNursery: null,
        hasYouthProgram: null,
        confidenceScore: 0.5,
        lastVerifiedAt: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schedules: [],
        ministries: [],
        campuses: [],
      };
      await store.seedChurch(church);
    }

    await page.goto('/churches?q=Church&page=2&pageSize=20');
    await expect(page.locator('#btn-prev-page')).toBeEnabled();
    await expect(page.locator('#btn-next-page')).toBeDisabled();
  });

  test('toggling map view renders Leaflet map with markers and CSS applied', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await page.locator('#btn-view-map').click();
    await expect(page.locator('#church-map')).toBeVisible();
    await expect(page.locator(`#church-marker-${FIRST_BAPTIST_AUSTIN.slug}`)).toBeVisible();
    await expectTileLayerMounted(page, 'church-map-tiles');
    await expectLeafletStylesheetApplied(page, 'church-map', 'church-map-tiles');
  });

  test('clicking church name navigates to detail page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await page.locator('#church-name-0').click();
    await page.waitForURL('**/churches/first-baptist-church-austin-tx**');
    await expect(page.locator('#church-name')).toContainText('First Baptist Church Austin');
  });

  test('paging forward scrolls to the top of the new page', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    for (let i = 0; i < 25; i++) {
      await store.seedChurch(churchNumbered(i));
    }

    await page.goto('/churches?q=Church&page=1&pageSize=20');
    await expect(page.locator('#btn-next-page')).toBeEnabled();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.locator('#btn-next-page').click();
    await page.waitForURL('**page=2**');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('going back restores the reader position', async ({ anonymousPage: page, store }) => {
    await store.reset();
    for (let i = 0; i < 25; i++) {
      await store.seedChurch(churchNumbered(i));
    }

    await page.goto('/churches?q=Church&page=1&pageSize=20');
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
});
