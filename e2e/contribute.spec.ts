import { newDisplayName, newPathSegment } from '@crgolden/modules/testing';
import { test, expect, CHURCH_WITH_DETAILS } from './fixtures.js';
import { contributeUrl } from '../src/app/app-paths';
import { BffPaths } from '../src/shared/bff-contract';
import { CorrectableFieldKeys } from '../src/shared/correctable-fields';

test.describe('CorrectionForm', () => {
  test('on load, shows expected fields', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page.locator('#contribute-title')).toBeVisible();
    await expect(page.locator('#correction-church-label')).toHaveAttribute('data-church-id', CHURCH_WITH_DETAILS.id);
    await expect(page.locator('#field-select')).toBeVisible();
    await expect(page.locator('#new-value')).toBeVisible();
    await expect(page.locator('#btn-submit-correction')).toBeVisible();
  });

  test('field selector defaults to canonicalName', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    const selected = await page.locator('#field-select').inputValue();
    expect(selected).toBe(CorrectableFieldKeys.canonicalName);
  });

  test('with valid input, shows success message', async ({ authedPage: page, store }) => {
    const correctedStreet = newDisplayName();
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await page.locator('#field-select').selectOption(CorrectableFieldKeys.street);
    await page.locator('#new-value').fill(correctedStreet);
    await page.locator('#btn-submit-correction').click();
    await expect(page.locator('#correction-submitted')).toBeVisible();
  });

  test('with empty new value, prevents submission', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await page.locator('#btn-submit-correction').click();
    await expect(page.locator('#correction-submitted')).toHaveCount(0);
    await expect(page.locator('#contribute-title')).toBeVisible();
  });

  test('when unauthenticated, redirects to login', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await page.waitForURL(`**${BffPaths.login}**`);
    expect(page.url()).toContain(BffPaths.login);
  });

  test('with invalid slug, redirects to home', async ({ authedPage: page, store }) => {
    const unknownSlug = newPathSegment();
    await store.reset();

    await page.goto(contributeUrl(unknownSlug));
    await page.waitForFunction(() => window.location.pathname === '/');
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
