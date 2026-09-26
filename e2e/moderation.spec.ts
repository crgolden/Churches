import { test, expect, CHURCH_WITH_DETAILS } from './fixtures.js';
import type { CorrectionRecord } from './fixtures.js';
import { churchUrl } from '../src/app/app-paths';
import { CorrectableFieldKeys } from '../src/shared/correctable-fields';
import { CorrectionStatus } from './mocks/directory-constants';

function pendingCorrection(): Omit<CorrectionRecord, 'createdAt'> {
  return {
    id: crypto.randomUUID(),
    churchId: CHURCH_WITH_DETAILS.id,
    userId: crypto.randomUUID(),
    field: CorrectableFieldKeys.street,
    oldValue: CHURCH_WITH_DETAILS.street,
    newValue: crypto.randomUUID(),
    status: CorrectionStatus.Pending,
    reviewedBy: null,
    reviewedAt: null,
    churchName: CHURCH_WITH_DETAILS.canonicalName,
    targetChurchName: null,
    churchSlug: CHURCH_WITH_DETAILS.slug,
    targetChurchSlug: null,
  };
}

test.describe('ModerationQueue', () => {
  test('when not moderator, redirects to home', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/admin/moderation');
    await page.waitForFunction(() => window.location.pathname === '/');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('when moderator, shows pending corrections', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    const correction = pendingCorrection();
    await store.seedCorrection(correction);

    await page.goto('/admin/moderation');
    await expect(page.locator('#moderation-title')).toBeVisible();
    await expect(page.locator('#correction-row-0')).toHaveAttribute('data-correction-id', correction.id);
    await expect(page.locator('#correction-church-link-0')).toHaveAttribute(
      'href',
      churchUrl(CHURCH_WITH_DETAILS.slug),
    );
    await expect(page.locator('#correction-new-value-0')).toBeVisible();
  });

  test('approving correction removes it from queue and writes the value to the church', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    const correction = pendingCorrection();
    await store.seedCorrection(correction);

    await page.goto('/admin/moderation');
    await page.locator('#btn-approve-0').click();
    await expect(page.locator('#moderation-empty')).toBeVisible();

    await page.goto(churchUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page.locator('#church-street')).toHaveAttribute('data-street', correction.newValue);
  });

  test('rejecting correction removes it from queue', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);
    await store.seedCorrection(pendingCorrection());

    await page.goto('/admin/moderation');
    await page.locator('#btn-reject-0').click();
    await expect(page.locator('#moderation-empty')).toBeVisible();
  });

  test('when empty, shows empty state', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/admin/moderation');
    await expect(page.locator('#moderation-empty')).toBeVisible();
  });
});
