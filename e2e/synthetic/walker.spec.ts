import { loginWithPasskey, resolveSeed, resolveStepBudget, toCredentialSlot, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test } from '@playwright/test';
import { churchesActions } from './actions';
import walkerSettings from './walker-settings.json';
import { HOME_URL, MODERATION_URL } from '../../src/app/app-paths';
import { BffPaths, RETURN_URL_QUERY_PARAMETER } from '../../src/shared/bff-contract';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');

test.describe('Synthetic walker', () => {
  for (const { slot, role, moderates } of walkerSettings.journeys) {
    test(`walks the deployed app as a ${role} with a seeded random journey`, async ({ page }, testInfo) => {
      test.skip(!walkerBaseUrl, 'Synthetic walks target the deployed app only; set WalkerBaseUrl to run.');
      const seed = resolveSeed();
      const steps = resolveStepBudget(walkerSettings.stepBudget);
      await loginWithPasskey(page, {
        slot: toCredentialSlot(slot),
        loginPath: BffPaths.login,
        returnParam: RETURN_URL_QUERY_PARAMETER,
        returnPath: HOME_URL,
      });

      const moderationLink = page.locator('#nav-moderation');
      if (moderates) {
        await expect(moderationLink, `${role} should be offered the moderation queue`).toBeVisible();
        await moderationLink.click();
        await expect(page.locator('#moderation-title'), `${role} should reach the moderation queue`).toBeVisible();
        await page.goto(HOME_URL);
      } else {
        await expect(moderationLink, `${role} must not be offered the moderation queue`).toHaveCount(0);
        await page.goto(MODERATION_URL);
        await expect(page.locator('#moderation-title'), `${role} must not reach the moderation queue directly`).toHaveCount(0);
        await page.goto(HOME_URL);
      }

      const result = await walk(page, churchesActions, { seed, steps, testInfo });
      expect(result.executedSteps).toBe(steps);
    });
  }
});
