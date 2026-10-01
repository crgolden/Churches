import { expect, type Page, type Response } from '@playwright/test';
import { newDisplayName, newId, newMemberOf, randomIntBetween } from '@crgolden/modules/testing';
import { expectLeafletStylesheetApplied, expectTileLayerMounted } from '../map-assertions.js';
import { churchUrl } from '../../src/app/app-paths';
import { HttpMethods } from '../../src/bff/http-headers';
import { LOCATION_MAP_ID, LOCATION_MAP_TILES_ID } from '../../src/churches/map/map-ids';
import { DirectoryRoutes } from '../../src/shared/directory-api';
import { DAYS_OF_WEEK, type Ministry, type ServiceSchedule } from '../../src/shared/models';
import { Then, When } from './fixtures.js';

function directoryResponse(page: Page, route: string, method: string): Promise<Response> {
  return page.waitForResponse(response => response.url().includes(route) && response.request().method() === method);
}

When('I open a church page that does not exist', async ({ page }) => {
  await page.goto(churchUrl(newId()));
});

When('I add a service time', async ({ page, ctx }) => {
  const day = newMemberOf(DAYS_OF_WEEK);
  await page.locator('#schedule-day').selectOption({ label: day.label });
  await page.locator('#schedule-time').fill(`${randomIntBetween(10, 24)}:${randomIntBetween(10, 60)}`);
  await page.locator('#schedule-desc').fill(newDisplayName());
  const created = directoryResponse(page, DirectoryRoutes.schedules, HttpMethods.post);
  await page.locator('#add-schedule').click();
  ctx.createdId = ((await (await created).json()) as Pick<ServiceSchedule, 'id'>).id;
  await page.waitForLoadState('networkidle');
});

When("I remove that church's first service time", async ({ page }) => {
  const deleted = directoryResponse(page, DirectoryRoutes.schedules, HttpMethods.delete);
  await page.locator('#schedule-delete-0').click();
  await page.locator('#schedule-delete-confirm-0').click();
  await deleted;
  await page.waitForLoadState('networkidle');
});

When('I add a ministry', async ({ page, ctx }) => {
  await expect(page.locator('#ministry-name')).toBeVisible();
  await page.locator('#ministry-name').fill(newDisplayName());
  const created = directoryResponse(page, DirectoryRoutes.ministries, HttpMethods.post);
  await page.locator('#add-ministry').click();
  ctx.createdId = ((await (await created).json()) as Pick<Ministry, 'id'>).id;
  await page.waitForLoadState('networkidle');
});

Then("I see all of that church's details", async ({ page, ctx }) => {
  const church = ctx.church;
  await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', church.id);
  await expect(page.locator('#church-address')).toBeVisible();
  await expect(page.locator('#church-street')).toBeVisible();
  await expect(page.locator('#church-phone')).toBeVisible();
  await expect(page.locator('#church-website')).toBeVisible();
  await expect(page.locator('#church-email')).toBeVisible();
  await expect(page.locator('#church-worship-style')).toHaveAttribute('data-worship-style', String(church.worshipStyle));
  await expect(page.locator('#church-language')).toBeVisible();
  await expect(page.locator('#church-wheelchair')).toBeVisible();
  await expect(page.locator('#church-schedule-0')).toHaveAttribute('data-schedule-id', church.schedules[0].id);
  await expect(page.locator('#church-schedule-1')).toHaveAttribute('data-schedule-id', church.schedules[1].id);
  await expect(page.locator('#church-ministry-0')).toHaveAttribute('data-ministry-id', church.ministries[0].id);
  await expect(page.locator('#church-ministry-1')).toHaveAttribute('data-ministry-id', church.ministries[1].id);
  await expect(page.locator('#church-campus-0')).toHaveAttribute('data-campus-id', church.campuses[0].id);
});

Then('I see that church and its campuses on a map', async ({ page, ctx }) => {
  await expect(page.locator(`#${LOCATION_MAP_ID}`)).toBeVisible();
  await expect(page.locator('[id^="location-marker-"]')).toHaveCount([ctx.church, ...ctx.church.campuses].length);
  await expectTileLayerMounted(page, LOCATION_MAP_TILES_ID);
  await expectLeafletStylesheetApplied(page, LOCATION_MAP_ID, LOCATION_MAP_TILES_ID);
});

Then('I see no empty details', async ({ page, ctx }) => {
  await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', ctx.church.id);
  await expect(page.locator('#church-phone')).toHaveCount(0);
  await expect(page.locator('#church-website')).toHaveCount(0);
  await expect(page.locator('#church-wheelchair')).toHaveCount(0);
  await expect(page.locator('#church-schedules')).toHaveCount(0);
  await expect(page.locator('#church-ministries')).toHaveCount(0);
  await expect(page.locator('#church-campuses')).toHaveCount(0);
});

Then('I am told the church was not found', async ({ page }) => {
  await expect(page.locator('#church-error')).toBeVisible();
});

Then('I am not offered to suggest a correction', async ({ page }) => {
  await expect(page.locator('#contribute-link')).toHaveCount(0);
});

Then('I am offered to suggest a correction', async ({ page }) => {
  await expect(page.locator('#contribute-link')).toBeVisible();
});

Then('I see the new service time', async ({ page, ctx }) => {
  await expect(page.locator('#church-schedule-0')).toHaveAttribute('data-schedule-id', ctx.createdId);
});

Then('that service time is gone', async ({ page, ctx }) => {
  await expect(page.locator('#church-schedule-0')).toHaveAttribute('data-schedule-id', ctx.church.schedules[1].id);
  await expect(page.locator('#church-schedule-1')).toHaveCount(0);
});

Then('I see the new ministry', async ({ page, ctx }) => {
  await expect(page.locator('#church-ministry-0')).toHaveAttribute('data-ministry-id', ctx.createdId);
});
