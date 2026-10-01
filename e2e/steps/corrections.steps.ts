import { expect, type Page } from '@playwright/test';
import { newDisplayName, newPathSegment, newText } from '@crgolden/modules/testing';
import { contributeUrl } from '../../src/app/app-paths';
import { ContributeErrors } from '../../src/churches/contribute/contribute-errors';
import { BffPaths, RETURN_URL_QUERY_PARAMETER } from '../../src/shared/bff-contract';
import { CorrectableFieldKeys, type CorrectableField } from '../../src/shared/correctable-fields';
import { Then, When } from './fixtures.js';

async function suggest(page: Page, slug: string, field: CorrectableField, value: string): Promise<void> {
  await page.goto(contributeUrl(slug));
  await page.locator('#field-select').selectOption(field);
  await page.locator('#new-value').fill(value);
  await page.locator('#btn-submit-correction').click();
}

When('I start a correction for that church', async ({ page, ctx }) => {
  await page.goto(contributeUrl(ctx.church.slug));
});

When('I start a correction for a church that does not exist', async ({ page }) => {
  await page.goto(contributeUrl(newPathSegment()));
});

When('I suggest a new street for that church', async ({ page, ctx }) => {
  await suggest(page, ctx.church.slug, CorrectableFieldKeys.street, newDisplayName());
});

When('I suggest a phone number for that church', async ({ page, ctx }) => {
  await suggest(page, ctx.church.slug, CorrectableFieldKeys.phoneNumber, newText());
});

When("I suggest that church's current street", async ({ page, ctx }) => {
  await suggest(page, ctx.church.slug, CorrectableFieldKeys.street, String(ctx.church.street));
});

Then('I see the correction form for that church', async ({ page, ctx }) => {
  await expect(page).toHaveURL(new RegExp(`${contributeUrl(ctx.church.slug)}$`));
  await expect(page.locator('#contribute-title')).toBeVisible();
  await expect(page.locator('#correction-church-label')).toHaveAttribute('data-church-id', ctx.church.id);
  await expect(page.locator('#field-select')).toBeVisible();
  await expect(page.locator('#new-value')).toBeVisible();
  await expect(page.locator('#btn-submit-correction')).toBeVisible();
});

Then('I am told my suggestion was received', async ({ page }) => {
  await expect(page.locator('#correction-submitted')).toBeVisible();
});

Then('I am told the church already has that value', async ({ page }) => {
  await expect(page.locator('#correction-error')).toHaveAttribute('data-error', ContributeErrors.alreadyHasValue);
});

Then('no suggestion is received', async ({ page }) => {
  await expect(page.locator('#correction-submitted')).toHaveCount(0);
});

Then('I am sent to sign in and brought back to that correction afterwards', async ({ page, ctx }) => {
  await page.waitForURL(`**${BffPaths.login}**`);
  expect(new URL(page.url()).searchParams.get(RETURN_URL_QUERY_PARAMETER)).toBe(contributeUrl(ctx.church.slug));
});
