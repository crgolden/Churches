/**
 * Port of C# ContributeTests — correction submission form.
 */

import { test, expect, FIRST_BAPTIST_AUSTIN, MOSAIC_AUSTIN } from './fixtures.js';

test.describe('CorrectionForm', () => {
  test('on load, shows expected fields', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await expect(page.locator('h1')).toContainText('Suggest a Correction');
    await expect(page.locator('text=First Baptist Church Austin')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Correction' })).toBeVisible();
  });

  test('field selector defaults to canonicalName', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    const selected = await page.locator('select').inputValue();
    expect(selected).toBe('canonicalName');
  });

  test('with valid input, shows success message', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.locator('select').selectOption('street');
    await page.getByRole('textbox').fill('123 New Street');
    await page.getByRole('button', { name: 'Submit Correction' }).click();
    await expect(page.locator('text=submitted for review')).toBeVisible();
  });

  test('with empty new value, prevents submission', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.getByRole('button', { name: 'Submit Correction' }).click();
    await expect(page.locator('text=submitted for review')).toHaveCount(0);
    await expect(page.locator('h1')).toContainText('Suggest a Correction');
  });

  test('when unauthenticated, redirects to login', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/bff/login');
  });

  test('with invalid slug, redirects to home', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/contribute/this-slug-does-not-exist');
    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
