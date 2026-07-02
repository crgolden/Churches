/**
 * Port of C# ChurchDetailTests — church detail page coverage including
 * the Leaflet CSS guard, moderator add/delete flows, and SSR assertions.
 */

import { test, expect, FIRST_BAPTIST_AUSTIN, MOSAIC_AUSTIN } from './fixtures.js';

test.describe('ChurchDetail', () => {
  test('with full data, renders all fields', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches/first-baptist-church-austin-tx');

    await expect(page.locator('#church-name')).toContainText('First Baptist Church Austin');
    await expect(page.locator('#church-address')).toContainText('901 Trinity St');
    await expect(page.locator('#church-address')).toContainText('Austin, TX 78701');
    await expect(page.locator('#church-phone')).toBeVisible();
    await expect(page.locator('#church-website')).toBeVisible();
    await expect(page.locator('#church-email')).toBeVisible();
    await expect(page.locator('#church-worship-style')).toHaveText('Traditional');
    await expect(page.locator('#church-language')).toHaveText('English');
    await expect(page.locator('#church-wheelchair')).toBeVisible();
    await expect(page.locator('#church-schedules')).toBeVisible();
    await expect(page.locator('#church-schedules')).toContainText('Sunday 10:00');
    await expect(page.locator('#church-schedules')).toContainText('Bible Study');
    await expect(page.locator('#church-ministries')).toBeVisible();
    await expect(page.locator('#church-ministries')).toContainText('Youth Group');
    await expect(page.locator('#church-ministries')).toContainText('Food Bank');
    await expect(page.locator('#church-campuses')).toBeVisible();
    await expect(page.locator('#church-campuses')).toContainText('North Campus');
    await expect(page.locator('#church-campuses')).toContainText('1200 N Lamar Blvd');
    await expect(page.locator('#church-map-section .leaflet-container')).toBeVisible();

    // Location heading must horizontally align with the Contact/About headings.
    const headingsAligned = await page.evaluate(() => {
      const contact = document.querySelector('.detail-body .detail-section h4');
      const location = document.querySelector('#church-map-section h4');
      if (!contact || !location) return false;
      return Math.abs(contact.getBoundingClientRect().left - location.getBoundingClientRect().left) < 1;
    });
    expect(headingsAligned).toBe(true);

    // Main church + one campus marker.
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);

    // Leaflet CSS guard — same assertion as the list map.
    await expect(page.locator('.leaflet-tile').first()).toBeVisible();
    const mapPanePos = await page.evaluate(
      () => getComputedStyle(document.querySelector('.leaflet-map-pane')!).position,
    );
    expect(mapPanePos).toBe('absolute');
    const tilePos = await page.evaluate(
      () => getComputedStyle(document.querySelector('.leaflet-tile')!).position,
    );
    expect(tilePos).toBe('absolute');
  });

  test('with sparse data, omits null fields', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(MOSAIC_AUSTIN);

    await page.goto('/churches/mosaic-church-austin-tx');

    await expect(page.locator('#church-name')).toContainText('Mosaic Church Austin');
    await expect(page.locator('#church-phone')).toHaveCount(0);
    await expect(page.locator('#church-website')).toHaveCount(0);
    await expect(page.locator('#church-wheelchair')).toHaveCount(0);
    await expect(page.locator('#church-schedules')).toHaveCount(0);
    await expect(page.locator('#church-ministries')).toHaveCount(0);
    await expect(page.locator('#church-campuses')).toHaveCount(0);
  });

  test('with invalid slug, shows not-found message', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/churches/this-slug-does-not-exist');
    await expect(page.locator('#church-error')).toBeVisible();
  });

  test('when anonymous, hides contribute link', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches/first-baptist-church-austin-tx');
    await expect(page.locator('#contribute-link')).toHaveCount(0);
  });

  test('when authenticated, shows contribute link', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/churches/first-baptist-church-austin-tx');
    await expect(page.locator('#contribute-link')).toBeVisible();
  });

  test('as moderator, can add and delete a schedule', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(MOSAIC_AUSTIN);

    await page.goto('/churches/mosaic-church-austin-tx');
    await expect(page.locator('#church-name')).toContainText('Mosaic Church Austin');

    // Wait for auth to settle and moderator UI to appear.
    await expect(page.locator("label[for='schedule-day']")).toBeVisible();

    // Render guard: add-form must be laid out with CSS grid, not plain block.
    await expect(page.locator("label[for='schedule-time']")).toBeVisible();
    const gridDisplay = await page.evaluate(
      () => getComputedStyle(document.querySelector('.mod-add-grid')!).display,
    );
    expect(gridDisplay).toBe('grid');
    const gridRowGap = await page.evaluate(
      () => getComputedStyle(document.querySelector('.mod-add-grid')!).rowGap,
    );
    expect(gridRowGap).not.toBe('0px');
    expect(gridRowGap).not.toBe('normal');

    // Add a schedule.  Wait for the POST + reload round-trip to complete.
    await page.getByLabel('Day of week').selectOption({ label: 'Wednesday' });
    await page.locator('#schedule-time').fill('19:00');
    await page.locator('#schedule-desc').fill('Midweek Prayer');
    const scheduleResponsePromise = page.waitForResponse(r => r.url().includes('/schedules') && r.request().method() === 'POST');
    await page.locator('#add-schedule').click();
    await scheduleResponsePromise;
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#church-schedules')).toContainText('Wednesday 19:00', { timeout: 15_000 });
    await expect(page.locator('#church-schedules')).toContainText('Midweek Prayer', { timeout: 15_000 });

    // Delete it.
    const deleteResponsePromise = page.waitForResponse(r => r.url().includes('/schedules') && r.request().method() === 'DELETE');
    await page.locator("#church-schedules button[aria-label='Delete schedule']").click();
    await deleteResponsePromise;
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#church-schedules li')).toHaveCount(0, { timeout: 15_000 });
  });

  test('as moderator, can add a ministry', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(MOSAIC_AUSTIN);

    await page.goto('/churches/mosaic-church-austin-tx');
    await expect(page.locator('#church-name')).toContainText('Mosaic Church Austin');

    // Wait for auth to settle and moderator UI to appear.
    await expect(page.locator('#ministry-name')).toBeVisible();

    const ministryResponsePromise = page.waitForResponse(r => r.url().includes('/ministries') && r.request().method() === 'POST');
    await page.locator('#ministry-name').fill('Recovery Group');
    await page.locator('#add-ministry').click();
    await ministryResponsePromise;
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#church-ministries')).toContainText('Recovery Group', { timeout: 15_000 });
  });
});
