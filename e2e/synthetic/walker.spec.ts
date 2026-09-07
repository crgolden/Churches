import { loginWithPasskey, resolveSeed, resolveStepBudget, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test } from '@playwright/test';
import { churchesActions } from './actions';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');

const JOURNEYS = [
  { slot: 1, role: 'moderator', moderates: true },
  { slot: 2, role: 'visitor', moderates: false },
] as const;

test.describe('Synthetic walker', () => {
  for (const { slot, role, moderates } of JOURNEYS) {
    test(`walks the deployed app as a ${role} with a seeded random journey`, async ({ page }, testInfo) => {
      test.skip(!walkerBaseUrl, 'Synthetic walks target the deployed app only; set WalkerBaseUrl to run.');
      const seed = resolveSeed();
      const steps = resolveStepBudget();
      await loginWithPasskey(page, { slot, returnParam: 'returnUrl', returnPath: '/' });

      const moderationLink = page.locator('#nav-moderation');
      if (moderates) {
        await expect(moderationLink, `${role} should be offered the moderation queue`).toBeVisible();
        await moderationLink.click();
        await expect(page.locator('#moderation-title'), `${role} should reach the moderation queue`).toBeVisible();
        await page.goto('/');
      } else {
        await expect(moderationLink, `${role} must not be offered the moderation queue`).toHaveCount(0);
        await page.goto('/admin/moderation');
        await expect(page.locator('#moderation-title'), `${role} must not reach the moderation queue directly`).toHaveCount(0);
        await page.goto('/');
      }

      const result = await walk(page, churchesActions, { seed, steps, testInfo });
      expect(result.executedSteps).toBe(steps);
    });
  }
});
