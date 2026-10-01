import { expect, type Page } from '@playwright/test';
import { firstPageUrl } from '../test-data.js';
import { HOME_URL, churchUrl } from '../../src/app/app-paths';
import { SearchParamNames } from '../../src/shared/directory-api';
import { Given, Then, When } from './fixtures.js';

async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll('[ngh]').length === 0);
}

async function openTheResultsAndWaitForHydration(page: Page, name: string): Promise<void> {
  await page.goto(firstPageUrl({ [SearchParamNames.q]: name }), { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
}

When('I open the results for that church and the page becomes interactive', async ({ page, ctx }) => {
  await openTheResultsAndWaitForHydration(page, ctx.church.canonicalName);
});

Given('I have opened the results for that church and the page has become interactive', async ({ page, ctx }) => {
  await openTheResultsAndWaitForHydration(page, ctx.church.canonicalName);
  ctx.forgetDirectoryRequests();
});

When("I go from the home page to that church's page", async ({ page, ctx }) => {
  await page.goto(HOME_URL);
  await page.goto(churchUrl(ctx.church.slug), { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
});

Then('the page has not asked the directory for anything', ({ ctx }) => {
  expect(ctx.directoryRequests).toEqual([]);
});

Then('the page has asked the directory for that church', async ({ page, ctx }) => {
  await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', ctx.church.id);
  expect(ctx.directoryRequests).not.toEqual([]);
});
