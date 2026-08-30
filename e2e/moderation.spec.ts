import { test, expect, FIRST_BAPTIST_AUSTIN } from './fixtures.js';
import type { CorrectionRecord } from './fixtures.js';

function pendingCorrection(): Omit<CorrectionRecord, 'createdAt'> {
  return {
    id: crypto.randomUUID(),
    churchId: FIRST_BAPTIST_AUSTIN.id,
    userId: 'some-user-id',
    field: 'street',
    oldValue: '901 Trinity St',
    newValue: '999 New St',
    status: 0,
    reviewedBy: null,
    reviewedAt: null,
    churchName: 'First Baptist Church Austin',
  };
}

test.describe('ModerationQueue', () => {
  test('when not moderator, redirects to home', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/admin/moderation');
    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('when moderator, shows pending corrections', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await store.seedCorrection(pendingCorrection());

    await page.goto('/admin/moderation');
    await expect(page.locator('#moderation-title')).toContainText('Moderation Queue');
    await expect(page.locator('#correction-church-0')).toContainText('First Baptist Church Austin');
    await expect(page.locator('#correction-new-value-0')).toContainText('999 New St');
  });

  test('approving correction removes it from queue', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await store.seedCorrection(pendingCorrection());

    await page.goto('/admin/moderation');
    await page.locator('#btn-approve-0').click();
    await expect(page.locator('#moderation-empty')).toBeVisible();
  });

  test('rejecting correction removes it from queue', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);
    await store.seedCorrection(pendingCorrection());

    await page.goto('/admin/moderation');
    await page.locator('#btn-reject-0').click();
    await expect(page.locator('#moderation-empty')).toBeVisible();
  });

  test('when empty, shows empty state', async ({ modPage: page, store }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/admin/moderation');
    await expect(page.locator('#moderation-empty')).toBeVisible();
  });
});
