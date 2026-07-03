/**
 * Port of C# AnonymousTests — anonymous public browsing + SSR assertions.
 *
 * SSR proof section: fetches raw server-rendered HTML and asserts the SEO
 * tags Angular SSR writes during the render, proving the SEO gap is closed.
 */

import { test, expect, FIRST_BAPTIST_AUSTIN, MOSAIC_AUSTIN } from './fixtures.js';
import type { ChurchRecord } from './fixtures.js';

// ── SSR assertion helper ─────────────────────────────────────────────────────

async function assertLeafletStylesheetApplied(page: import('@playwright/test').Page): Promise<void> {
  const mapPanePos = await page.evaluate(
    () => getComputedStyle(document.querySelector('.leaflet-map-pane')!).position,
  );
  expect(mapPanePos).toBe('absolute');

  const tilePos = await page.evaluate(
    () => getComputedStyle(document.querySelector('.leaflet-tile')!).position,
  );
  expect(tilePos).toBe('absolute');

  const containerOverflow = await page.evaluate(
    () => getComputedStyle(document.querySelector('.leaflet-container')!).overflow,
  );
  expect(containerOverflow).toContain('hidden');
}

// ── SSR raw-HTML assertions ──────────────────────────────────────────────────

test.describe('SSR — raw HTML assertions', () => {
  test('churches list page is server-rendered with SEO tags', async ({ request, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const res = await request.get('/churches?q=Baptist');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    // Proves SSR (Angular writes this attribute on the server-rendered root).
    expect(html).toContain('ng-server-context');

    // <title> tag set by AppTitleStrategy / SeoService.setPage.
    expect(html).toMatch(/<title[^>]*>/);

    // Open Graph and Twitter Card (set by SeoService.setPage on the list component).
    expect(html).toContain('og:title');
    expect(html).toContain('twitter:card');
  });

  test('church detail page is server-rendered with full SEO', async ({ request, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const res = await request.get('/churches/first-baptist-church-austin-tx');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    // Proves SSR.
    expect(html).toContain('ng-server-context');

    // Church name appears in server-rendered markup (data was fetched server-side).
    expect(html).toContain('First Baptist Church Austin');

    // SEO tags present in raw HTML.
    expect(html).toMatch(/<title[^>]*>First Baptist Church Austin/);
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:url');
    expect(html).toContain('twitter:card');

    // JSON-LD structured data.
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"Church"');
  });
});

// ── Existing E2E tests (ported from AnonymousTests.cs) ───────────────────────

test.describe('HomePage', () => {
  test('on load, shows search form and heading', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Find Your Church Home');
    await expect(page.getByRole('textbox').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });
});

test.describe('SearchForm', () => {
  test('with keyword, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await page.getByRole('textbox').first().fill('Baptist');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('text=First Baptist Church Austin')).toBeVisible();
  });

  test('with state filter, shows matching churches', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await store.seedChurch(MOSAIC_AUSTIN);

    await page.goto('/');
    await page.locator("input[placeholder*='State'], input[name*='state'], input[id*='state']").first().fill('TX');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('text=Austin, TX').first()).toBeVisible();
  });

  test('with worship style filter, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await page.locator('#search-worship-style').selectOption('1');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain('/churches');
  });

  test('with wheelchair filter, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    await page.locator("input[type='checkbox']").check();
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain('/churches');
  });

  test('with no matching keyword, shows zero results', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.getByRole('textbox').first().fill('zzz_no_match_zzz');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForURL('**/churches**');
    await expect(page.locator('text=0 churches found')).toBeVisible();
  });

  test('when Enter key pressed, navigates to results page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');
    const input = page.getByRole('textbox').first();
    await input.fill('Baptist');
    await input.press('Enter');
    await page.waitForURL('**/churches**');
    expect(page.url()).toContain('/churches');
  });

  test('Near Me button click produces no console errors', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Near Me' }).click();
    await page.waitForTimeout(500);

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
    await expect(page.locator('text=churches found')).toBeVisible();
  });

  test('each card shows name link and location', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await expect(page.locator('a', { hasText: 'First Baptist Church Austin' })).toBeVisible();
    await expect(page.locator('text=Austin, TX')).toBeVisible();
  });

  test('without geolocation, omits distance column', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await expect(page.locator('text=miles away')).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
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
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  test('toggling map view renders Leaflet map with markers and CSS applied', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    await expect(page.locator('.leaflet-tile').first()).toBeVisible();

    // Guard against the missing-leaflet.css regression: without the stylesheet,
    // markers and the container exist but are not properly positioned/clipped.
    await assertLeafletStylesheetApplied(page);
  });

  test('clicking church name navigates to detail page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await page.locator('a', { hasText: 'First Baptist Church Austin' }).click();
    await page.waitForURL('**/churches/first-baptist-church-austin-tx**');
    await expect(page.locator('h1')).toContainText('First Baptist Church Austin');
  });
});
