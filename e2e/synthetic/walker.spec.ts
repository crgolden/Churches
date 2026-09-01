import { loginThroughIdentity, resolveSeed, resolveStepBudget, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test } from '@playwright/test';
import { churchesActions } from './actions';

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

test.describe('Synthetic walker', () => {
  test('walks the deployed app with a seeded random journey', async ({ page }, testInfo) => {
    test.skip(!smokeBaseUrl, 'Synthetic walks target the deployed app only; set SmokeBaseUrl to run.');
    const seed = resolveSeed();
    const steps = resolveStepBudget();
    await loginThroughIdentity(page, { returnParam: 'returnUrl', returnPath: '/' });
    const result = await walk(page, churchesActions, { seed, steps, testInfo });
    expect(result.executedSteps).toBe(steps);
  });
});
