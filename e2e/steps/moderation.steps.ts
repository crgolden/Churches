import { expect } from '@playwright/test';
import { newId } from '@crgolden/modules/testing';
import { CorrectionStatus } from '../mocks/directory-constants';
import { newChurchWithDetails } from '../test-data.js';
import { MODERATION_URL, churchUrl } from '../../src/app/app-paths';
import { CorrectableFieldKeys } from '../../src/shared/correctable-fields';
import { Given, Then, When } from './fixtures.js';

Given("a correction to a church's street is waiting for review", async ({ store, ctx }) => {
  const church = newChurchWithDetails();
  ctx.church = church;
  ctx.correction = {
    id: newId(),
    churchId: church.id,
    userId: newId(),
    field: CorrectableFieldKeys.street,
    oldValue: church.street,
    newValue: newId(),
    status: CorrectionStatus.Pending,
    reviewedBy: null,
    reviewedAt: null,
    churchName: church.canonicalName,
    targetChurchName: null,
    churchSlug: church.slug,
    targetChurchSlug: null,
  };
  await store.seedChurch(church);
  await store.seedCorrection(ctx.correction);
});

When('I open the moderation queue', async ({ page }) => {
  await page.goto(MODERATION_URL);
});

Given('I have opened the moderation queue', async ({ page }) => {
  await page.goto(MODERATION_URL);
  await expect(page.locator('#moderation-title')).toBeVisible();
});

When('I approve that correction', async ({ page }) => {
  await page.locator('#btn-approve-0').click();
});

When('I reject that correction', async ({ page }) => {
  await page.locator('#btn-reject-0').click();
});

Then('I see that correction, linked to its church', async ({ page, ctx }) => {
  await expect(page.locator('#moderation-title')).toBeVisible();
  await expect(page.locator('#correction-row-0')).toHaveAttribute('data-correction-id', ctx.correction.id);
  await expect(page.locator('#correction-church-link-0')).toHaveAttribute('href', churchUrl(ctx.church.slug));
  await expect(page.locator('#correction-new-value-0')).toBeVisible();
});

Then('the moderation queue is empty', async ({ page }) => {
  await expect(page.locator('#moderation-empty')).toBeVisible();
});

Then('that church shows the corrected street', async ({ page, ctx }) => {
  await page.goto(churchUrl(ctx.church.slug));
  await expect(page.locator('#church-street')).toHaveAttribute('data-street', ctx.correction.newValue);
});
