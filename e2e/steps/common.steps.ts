import { expect } from '@playwright/test';
import {
  newChurchWithDetails,
  newChurchWithoutDetails,
  signInAsMember,
  signInAsModerator,
  signInAsVisitor,
} from '../test-data.js';
import { CHURCH_NAME_ID_PREFIX } from '../../src/churches/list/church-list-ids';
import { HOME_URL, churchUrl } from '../../src/app/app-paths';
import { Given, Then, When } from './fixtures.js';

Given('I am a visitor', async ({ page }) => {
  await signInAsVisitor(page);
});

Given('I am a signed-in member', async ({ page }) => {
  await signInAsMember(page);
});

Given('I am a moderator', async ({ page }) => {
  await signInAsModerator(page);
});

Given('a church is listed in the directory', async ({ store, ctx }) => {
  ctx.church = newChurchWithDetails();
  await store.seedChurch(ctx.church);
});

Given('a church with full details is listed in the directory', async ({ store, ctx }) => {
  ctx.church = newChurchWithDetails();
  await store.seedChurch(ctx.church);
});

Given('a church with only basic details is listed in the directory', async ({ store, ctx }) => {
  ctx.church = newChurchWithoutDetails();
  await store.seedChurch(ctx.church);
});

Given('an inactive church is in the directory', async ({ store, ctx }) => {
  ctx.church = { ...newChurchWithDetails(), isActive: false };
  await store.seedChurch(ctx.church);
});

Given('a church the directory has low confidence in is listed', async ({ store, ctx }) => {
  ctx.church = { ...newChurchWithoutDetails(), confidenceScore: 0 };
  await store.seedChurch(ctx.church);
});

Given('no church is listed in the directory', async ({ store }) => {
  await store.reset();
});

When("I open that church's page", async ({ page, ctx }) => {
  await page.goto(churchUrl(ctx.church.slug));
});

Given("I have opened that church's page", async ({ page, ctx }) => {
  await page.goto(churchUrl(ctx.church.slug));
  await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', ctx.church.id);
});

Then("I see that church's page", async ({ page, ctx }) => {
  await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', ctx.church.id);
});

Then('I am told no church matched', async ({ page }) => {
  await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String(0));
  await expect(page.locator(`[id^="${CHURCH_NAME_ID_PREFIX}"]`)).toHaveCount(0);
});

Then('I am taken to the home page', async ({ page }) => {
  await page.waitForFunction(home => window.location.pathname === home, HOME_URL);
  expect(new URL(page.url()).pathname).toBe(HOME_URL);
});

Then('the page raises no script error', ({ ctx }) => {
  expect(ctx.scriptErrors).toEqual([]);
});
