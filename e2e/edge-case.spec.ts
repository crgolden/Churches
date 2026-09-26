import { newText } from '@crgolden/modules/testing';
import {
  test,
  expect,
  CHURCH_WITH_DETAILS,
  CHURCH_WITHOUT_DETAILS,
  firstPageUrl,
  seedChurches,
} from './fixtures.js';
import { churchUrl, contributeUrl } from '../src/app/app-paths';
import { CorrectableFieldKeys } from '../src/shared/correctable-fields';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../src/shared/directory-api';
import { ContributeErrors } from '../src/churches/contribute/contribute-errors';
import { CHURCH_NAME_ID_PREFIX } from '../src/churches/list/church-list-ids';

test.describe('EdgeCases', () => {
  test('anonymous navigation across pages produces no console errors', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('[ngh]').length === 0);

    expect(errors).toHaveLength(0);
  });

  test('authenticated navigation across pages produces no console errors', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('[ngh]').length === 0);

    expect(errors).toHaveLength(0);
  });

  test('inactive church is hidden from search results', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch({ ...CHURCH_WITH_DETAILS, isActive: false });

    await page.goto(firstPageUrl({ [SearchParamNames.q]: CHURCH_WITH_DETAILS.canonicalName }));
    await expect(page.locator(`[id^="${CHURCH_NAME_ID_PREFIX}"]`)).toHaveCount(0);
    await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String(0));
  });

  test('inactive church on detail page shows not-found message', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch({ ...CHURCH_WITH_DETAILS, isActive: false });

    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page.locator('#church-error')).toBeVisible();
  });

  test('church with low confidence score renders successfully', async ({
    anonymousPage: page,
    store,
  }) => {
    const lowConfidenceChurch = { ...CHURCH_WITHOUT_DETAILS, confidenceScore: 0 };
    await store.reset();
    await store.seedChurch(lowConfidenceChurch);

    await page.goto(churchUrl(lowConfidenceChurch.slug));
    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', lowConfidenceChurch.id);
  });

  test('correction for field with null current value submits successfully', async ({
    authedPage: page,
    store,
  }) => {
    const suggestedPhoneNumber = newText();
    await store.reset();
    await store.seedChurch(CHURCH_WITHOUT_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITHOUT_DETAILS.slug));
    await page.locator('#field-select').selectOption(CorrectableFieldKeys.phoneNumber);
    await page.locator('#new-value').fill(suggestedPhoneNumber);
    await page.locator('#btn-submit-correction').click();
    await expect(page.locator('#correction-submitted')).toBeVisible();
  });

  test('correction with unchanged value shows no-change error', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await page.locator('#field-select').selectOption(CorrectableFieldKeys.street);
    await page.locator('#new-value').fill(String(CHURCH_WITH_DETAILS.street));
    await page.locator('#btn-submit-correction').click();
    await expect(page.locator('#correction-error')).toHaveAttribute('data-error', ContributeErrors.alreadyHasValue);
    await expect(page.locator('#correction-submitted')).toHaveCount(0);
  });

  test('church list with exactly page-size results hides Next button', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await seedChurches(store, DEFAULT_PAGE_SIZE);

    await page.goto(firstPageUrl());
    await expect(page.locator('#btn-next-page')).toHaveCount(0);
  });
});
