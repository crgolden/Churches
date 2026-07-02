/**
 * Port of C# EdgeCaseTests — inactive churches, low-confidence data, boundary
 * conditions, and console-error guards.
 */

import { test, expect, FIRST_BAPTIST_AUSTIN, MOSAIC_AUSTIN } from './fixtures.js';
import type { ChurchRecord } from './fixtures.js';

test.describe('EdgeCases', () => {
  test('anonymous navigation across pages produces no unexpected console errors', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('/bff/user') && !msg.text().includes('401')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.goto('/churches/first-baptist-church-austin-tx', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  test('authenticated navigation across pages produces no console errors', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.goto('/churches/first-baptist-church-austin-tx', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  test('inactive church is hidden from search results', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch({ ...FIRST_BAPTIST_AUSTIN, isActive: false });

    await page.goto('/churches?q=Baptist&page=1&pageSize=20');
    await expect(page.locator('text=First Baptist Church Austin')).toHaveCount(0);
    await expect(page.locator('text=0 churches found')).toBeVisible();
  });

  test('inactive church on detail page shows not-found message', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch({ ...FIRST_BAPTIST_AUSTIN, isActive: false });

    await page.goto('/churches/first-baptist-church-austin-tx');
    await expect(page.locator('text=Church not found')).toBeVisible();
  });

  test('church with low confidence score renders successfully', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(MOSAIC_AUSTIN); // confidenceScore 0.2

    await page.goto('/churches/mosaic-church-austin-tx');
    await expect(page.locator('h1')).toContainText('Mosaic Church Austin');
  });

  test('correction for field with null current value submits successfully', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(MOSAIC_AUSTIN); // phoneNumber: null

    await page.goto('/contribute/mosaic-church-austin-tx');
    await page.locator('select').selectOption('phoneNumber');
    await page.getByRole('textbox').fill('(512) 555-0100');
    await page.getByRole('button', { name: 'Submit Correction' }).click();
    await expect(page.locator('text=submitted for review')).toBeVisible();
  });

  test('correction with unchanged value shows no-change error', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN); // street: '901 Trinity St'

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.locator('select').selectOption('street');
    await page.getByRole('textbox').fill('901 Trinity St');
    await page.getByRole('button', { name: 'Submit Correction' }).click();
    await expect(page.locator('text=already has that value')).toBeVisible();
    await expect(page.locator('text=submitted for review')).toHaveCount(0);
  });

  test('church list with exactly page-size results hides Next button', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    for (let i = 0; i < 20; i++) {
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
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
  });
});
