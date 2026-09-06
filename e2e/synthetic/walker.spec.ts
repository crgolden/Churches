import { loginWithPasskey, resolveSeed, resolveStepBudget, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test } from '@playwright/test';
import { churchesActions } from './actions';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');

test.describe('Synthetic walker', () => {
  test('walks the deployed app with a seeded random journey', async ({ page }, testInfo) => {
    test.skip(!walkerBaseUrl, 'Synthetic walks target the deployed app only; set WalkerBaseUrl to run.');
    const seed = resolveSeed();
    const steps = resolveStepBudget();
    await loginWithPasskey(page, { slot: 1, returnParam: 'returnUrl', returnPath: '/' });
    const result = await walk(page, churchesActions, { seed, steps, testInfo });
    expect(result.executedSteps).toBe(steps);
  });
});
