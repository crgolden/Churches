import { newDisplayName, newMemberOf, randomIntBetween } from '@crgolden/modules/testing';
import { test, expect, CHURCH_WITH_DETAILS, CHURCH_WITHOUT_DETAILS } from './fixtures.js';
import { computedStyleOf } from './computed-style.js';
import { CssValues } from './css-constants.js';
import { expectLeafletStylesheetApplied, expectTileLayerMounted } from './map-assertions.js';
import { HttpMethods } from '../src/bff/http-headers';
import { churchUrl } from '../src/app/app-paths';
import { DirectoryRoutes } from '../src/shared/directory-api';
import { LOCATION_MAP_ID, LOCATION_MAP_TILES_ID } from '../src/churches/map/map-ids';
import { DAYS_OF_WEEK, type Ministry, type ServiceSchedule } from '../src/shared/models';

test.describe('ChurchDetail', () => {
  test('with full data, renders all fields', async ({ anonymousPage: page, store }) => {
    const mappedLocationCount = [CHURCH_WITH_DETAILS, ...CHURCH_WITH_DETAILS.campuses].length;
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug));

    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', CHURCH_WITH_DETAILS.id);
    await expect(page.locator('#church-address')).toBeVisible();
    await expect(page.locator('#church-street')).toBeVisible();
    await expect(page.locator('#church-phone')).toBeVisible();
    await expect(page.locator('#church-website')).toBeVisible();
    await expect(page.locator('#church-email')).toBeVisible();
    await expect(page.locator('#church-worship-style')).toHaveAttribute('data-worship-style', String(CHURCH_WITH_DETAILS.worshipStyle));
    await expect(page.locator('#church-language')).toBeVisible();
    await expect(page.locator('#church-wheelchair')).toBeVisible();
    await expect(page.locator('#church-schedule-0')).toHaveAttribute('data-schedule-id', CHURCH_WITH_DETAILS.schedules[0].id);
    await expect(page.locator('#church-schedule-1')).toHaveAttribute('data-schedule-id', CHURCH_WITH_DETAILS.schedules[1].id);
    await expect(page.locator('#church-ministry-0')).toHaveAttribute('data-ministry-id', CHURCH_WITH_DETAILS.ministries[0].id);
    await expect(page.locator('#church-ministry-1')).toHaveAttribute('data-ministry-id', CHURCH_WITH_DETAILS.ministries[1].id);
    await expect(page.locator('#church-campus-0')).toHaveAttribute('data-campus-id', CHURCH_WITH_DETAILS.campuses[0].id);
    await expect(page.locator(`#${LOCATION_MAP_ID}`)).toBeVisible();

    const headingLeftOffsets = await page.evaluate(() => {
      const contact = document.querySelector('#church-contact-heading');
      const location = document.querySelector('#church-map-section h2');
      if (contact === null || location === null) {
        throw new Error('Expected #church-contact-heading and #church-map-section h2 to both exist.');
      }
      return [contact.getBoundingClientRect().left, location.getBoundingClientRect().left];
    });
    expect(Math.abs(headingLeftOffsets[0] - headingLeftOffsets[1])).toBeLessThan(1);

    await expect(page.locator('[id^="location-marker-"]')).toHaveCount(mappedLocationCount);
    await expectTileLayerMounted(page, LOCATION_MAP_TILES_ID);
    await expectLeafletStylesheetApplied(page, LOCATION_MAP_ID, LOCATION_MAP_TILES_ID);
  });

  test('with sparse data, omits null fields', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITHOUT_DETAILS);

    await page.goto(churchUrl(CHURCH_WITHOUT_DETAILS.slug));

    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', CHURCH_WITHOUT_DETAILS.id);
    await expect(page.locator('#church-phone')).toHaveCount(0);
    await expect(page.locator('#church-website')).toHaveCount(0);
    await expect(page.locator('#church-wheelchair')).toHaveCount(0);
    await expect(page.locator('#church-schedules')).toHaveCount(0);
    await expect(page.locator('#church-ministries')).toHaveCount(0);
    await expect(page.locator('#church-campuses')).toHaveCount(0);
  });

  test('with invalid slug, shows not-found message', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(churchUrl(crypto.randomUUID()));
    await expect(page.locator('#church-error')).toBeVisible();
  });

  test('when anonymous, hides contribute link', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page.locator('#contribute-link')).toHaveCount(0);
  });

  test('when authenticated, shows contribute link', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page.locator('#contribute-link')).toBeVisible();
  });

  test('as moderator, can add and delete a schedule', async ({ modPage: page, store }) => {
    const scheduleDay = newMemberOf(DAYS_OF_WEEK);
    const scheduleTime = `${randomIntBetween(10, 24)}:${randomIntBetween(10, 60)}`;
    const scheduleDescription = newDisplayName();
    await store.reset();
    await store.seedChurch(CHURCH_WITHOUT_DETAILS);

    await page.goto(churchUrl(CHURCH_WITHOUT_DETAILS.slug));
    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', CHURCH_WITHOUT_DETAILS.id);

    await expect(page.locator("label[for='schedule-day']")).toBeVisible();
    await expect(page.locator("label[for='schedule-time']")).toBeVisible();
    const gridDisplay = await computedStyleOf(page, 'schedule-add-grid', 'display');
    expect(gridDisplay).toBe(CssValues.grid);
    const gridRowGap = await computedStyleOf(page, 'schedule-add-grid', 'row-gap');
    expect(gridRowGap).not.toBe(CssValues.zeroLength);
    expect(gridRowGap).not.toBe(CssValues.normal);

    await page.locator('#schedule-day').selectOption({ label: scheduleDay.label });
    await page.locator('#schedule-time').fill(scheduleTime);
    await page.locator('#schedule-desc').fill(scheduleDescription);
    const scheduleResponsePromise = page.waitForResponse(r => r.url().includes(DirectoryRoutes.schedules) && r.request().method() === HttpMethods.post);
    await page.locator('#add-schedule').click();
    const createdSchedule = (await (await scheduleResponsePromise).json()) as Pick<ServiceSchedule, 'id'>;
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#church-schedule-0')).toHaveAttribute('data-schedule-id', createdSchedule.id);

    const deleteResponsePromise = page.waitForResponse(r => r.url().includes(DirectoryRoutes.schedules) && r.request().method() === HttpMethods.delete);
    await page.locator('#schedule-delete-0').click();
    await expect(page.locator('#church-schedules li')).toHaveCount(1);
    await page.locator('#schedule-delete-confirm-0').click();
    await deleteResponsePromise;
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#church-schedules li')).toHaveCount(0);
  });

  test('as moderator, can add a ministry', async ({ modPage: page, store }) => {
    const ministryName = newDisplayName();
    await store.reset();
    await store.seedChurch(CHURCH_WITHOUT_DETAILS);

    await page.goto(churchUrl(CHURCH_WITHOUT_DETAILS.slug));
    await expect(page.locator('#church-name')).toHaveAttribute('data-church-id', CHURCH_WITHOUT_DETAILS.id);

    await expect(page.locator('#ministry-name')).toBeVisible();

    const ministryResponsePromise = page.waitForResponse(r => r.url().includes(DirectoryRoutes.ministries) && r.request().method() === HttpMethods.post);
    await page.locator('#ministry-name').fill(ministryName);
    await page.locator('#add-ministry').click();
    const createdMinistry = (await (await ministryResponsePromise).json()) as Pick<Ministry, 'id'>;
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#church-ministry-0')).toHaveAttribute('data-ministry-id', createdMinistry.id);
  });
});
