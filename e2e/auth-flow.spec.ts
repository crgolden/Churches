/**
 * Port of C# AuthFlowTests — BFF session / claim assertions.
 *
 * Auth is mocked at the Playwright route level (/bff/user returns fake claims).
 * The actual OIDC discovery + code-exchange flow is exercised only by the Smoke
 * tests (ApiTests.BffLogin_FullLoginLogoutCycle_Succeeds).
 */

import { test, expect, FIRST_BAPTIST_AUSTIN } from './fixtures.js';

test.describe('AuthFlow', () => {
  test('contribute page when unauthenticated redirects to login with returnUrl', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
    expect(page.url()).toContain('returnUrl');
  });

  test('BFF session after mock login contains sub and email claims', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');

    // The /bff/user route is mocked — evaluate fetches from the browser context
    // and the Playwright route intercept returns our fake claims JSON.
    const json = await page.evaluate(async () => {
      const r = await fetch('/bff/user', { headers: { 'X-CSRF': '1' } });
      return r.json() as Promise<Array<{ type: string; value: string }>>;
    });

    const types = json.map(c => c.type);
    expect(types).toContain('sub');
    const sub = json.find(c => c.type === 'sub');
    expect(sub?.value).toBe('e2e-user-id');
    expect(types).toContain('email');
  });

  test('contribute page when authenticated shows form', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/contribute/first-baptist-church-austin-tx');
    await expect(page.locator('h1')).toContainText('Suggest a Correction');
  });

  test('BFF session as moderator contains churches.mod claim', async ({
    modPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(FIRST_BAPTIST_AUSTIN);

    await page.goto('/');

    const json = await page.evaluate(async () => {
      const r = await fetch('/bff/user', { headers: { 'X-CSRF': '1' } });
      return r.json() as Promise<Array<{ type: string; value: string }>>;
    });

    const mod = json.find(c => c.type === 'churches.mod');
    expect(mod?.value).toBe('true');
  });
});
