import { test, expect, FIRST_BAPTIST_AUSTIN, MOSAIC_AUSTIN } from './fixtures.js';

test.describe('CorrectionForm', () => {
  test('on load, shows expected fields', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await expect(page.locator('#contribute-title')).toContainText('Suggest a Correction');
    await expect(page.locator('#correction-church-label')).toContainText('First Baptist Church Austin');
    await expect(page.locator('#field-select')).toBeVisible();
    await expect(page.locator('#new-value')).toBeVisible();
    await expect(page.locator('#btn-submit-correction')).toBeVisible();
  });

  test('field selector defaults to canonicalName', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    const selected = await page.locator('#field-select').inputValue();
    expect(selected).toBe('canonicalName');
  });

  test('with valid input, shows success message', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.locator('#field-select').selectOption('street');
    await page.locator('#new-value').fill('123 New Street');
    await page.locator('#btn-submit-correction').click();
    await expect(page.locator('#correction-submitted')).toBeVisible();
  });

  test('with empty new value, prevents submission', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.locator('#btn-submit-correction').click();
    await expect(page.locator('#correction-submitted')).toHaveCount(0);
    await expect(page.locator('#contribute-title')).toContainText('Suggest a Correction');
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
