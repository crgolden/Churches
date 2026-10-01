import { expect } from '@playwright/test';
import { newText } from '@crgolden/modules/testing';
import { newChurchWithoutDetails } from '../test-data.js';
import { CHURCHES_URL, HOME_URL, churchUrl } from '../../src/app/app-paths';
import { churchNameId } from '../../src/churches/list/church-list-ids';
import { Given, Then, When } from './fixtures.js';

const RESULTS_PAGE = `**${CHURCHES_URL}**`;

Given('two churches are listed in the same state', async ({ store, ctx }) => {
  ctx.church = newChurchWithoutDetails();
  ctx.neighbours = [{ ...newChurchWithoutDetails(), state: ctx.church.state }];
  await store.seedChurch(ctx.church);
  await store.seedChurch(ctx.neighbours[0]);
});

Given('I am on the home page', async ({ page }) => {
  await page.goto(HOME_URL);
  await expect(page.locator('#search-title')).toBeVisible();
  await expect(page.locator('#search-keyword')).toBeVisible();
  await expect(page.locator('#btn-search')).toBeVisible();
});

Given('I have shared my location', async ({ page, ctx }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: ctx.church.latitude, longitude: ctx.church.longitude });
});

When('I search for that church by name', async ({ page, ctx }) => {
  await page.locator('#search-keyword').fill(ctx.church.canonicalName);
  await page.locator('#btn-search').click();
  await page.waitForURL(RESULTS_PAGE);
});

When('I search for churches in that state', async ({ page, ctx }) => {
  await page.locator('#search-state').fill(ctx.church.state);
  await page.locator('#btn-search').click();
  await page.waitForURL(RESULTS_PAGE);
});

When("I search for churches with that church's worship style", async ({ page, ctx }) => {
  await page.locator('#search-worship-style').selectOption(String(ctx.church.worshipStyle));
  await page.locator('#btn-search').click();
  await page.waitForURL(RESULTS_PAGE);
});

When('I search for wheelchair-accessible churches', async ({ page }) => {
  await page.locator('#search-wheelchair').check();
  await page.locator('#btn-search').click();
  await page.waitForURL(RESULTS_PAGE);
});

When('I search for a name no church has', async ({ page }) => {
  await page.locator('#search-keyword').fill(newText());
  await page.locator('#btn-search').click();
  await page.waitForURL(RESULTS_PAGE);
});

When("I type that church's name and press Enter", async ({ page, ctx }) => {
  const keyword = page.locator('#search-keyword');
  await keyword.fill(ctx.church.canonicalName);
  await keyword.press('Enter');
  await page.waitForURL(RESULTS_PAGE);
});

When('I ask for churches near me', async ({ page }) => {
  await page.locator('#btn-near-me').click();
});

Then('that church is in the results', async ({ page, ctx }) => {
  await expect(page.locator(`#${churchNameId(0)}`)).toHaveAttribute('href', churchUrl(ctx.church.slug));
});

Then('both churches are in the results', async ({ page, ctx }) => {
  await expect(page.locator('#result-count')).toHaveAttribute('data-total-count', String([ctx.church, ...ctx.neighbours].length));
  await expect(page.locator('#church-location-0')).toBeVisible();
});

Then('I see the search results', async ({ page }) => {
  expect(new URL(page.url()).pathname).toBe(CHURCHES_URL);
});

Then('I am told my location is being used', async ({ page }) => {
  await expect(page.locator('#location-note')).toBeVisible();
});
