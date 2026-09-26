import { test, expect, CHURCH_WITH_DETAILS, USER_SUBJECT } from './fixtures.js';
import { OidcClaimTypes } from './oidc-constants.js';
import { contributeUrl } from '../src/app/app-paths';
import {
  BffPaths,
  ClaimTypes,
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  MODERATOR_CLAIM_VALUE,
  RETURN_URL_QUERY_PARAMETER,
} from '../src/shared/bff-contract';

test.describe('AuthFlow', () => {
  test('contribute page when unauthenticated redirects to login with returnUrl', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await page.waitForURL(`**${BffPaths.login}**`);
    expect(new URL(page.url()).searchParams.get(RETURN_URL_QUERY_PARAMETER)).toBe(contributeUrl(CHURCH_WITH_DETAILS.slug));
  });

  test('BFF session after mock login contains sub and email claims', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');

    const json = await page.evaluate(async ({ path, header, value }) => {
      const r = await fetch(path, { headers: { [header]: value } });
      return r.json() as Promise<Array<{ type: string; value: string }>>;
    }, { path: BffPaths.user, header: CSRF_HEADER, value: CSRF_HEADER_VALUE });

    const types = json.map(c => c.type);
    expect(types).toContain(ClaimTypes.subject);
    const sub = json.find(c => c.type === ClaimTypes.subject);
    expect(sub?.value).toBe(USER_SUBJECT);
    expect(types).toContain(OidcClaimTypes.email);
  });

  test('contribute page when authenticated shows form', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto(contributeUrl(CHURCH_WITH_DETAILS.slug));
    await expect(page).toHaveURL(new RegExp(`${contributeUrl(CHURCH_WITH_DETAILS.slug)}$`));
    await expect(page.locator('#contribute-title')).toBeVisible();
  });

  test('BFF session as moderator contains churches.mod claim', async ({
    modPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedChurch(CHURCH_WITH_DETAILS);

    await page.goto('/');

    const json = await page.evaluate(async ({ path, header, value }) => {
      const r = await fetch(path, { headers: { [header]: value } });
      return r.json() as Promise<Array<{ type: string; value: string }>>;
    }, { path: BffPaths.user, header: CSRF_HEADER, value: CSRF_HEADER_VALUE });

    const mod = json.find(c => c.type === ClaimTypes.moderator);
    expect(mod?.value).toBe(MODERATOR_CLAIM_VALUE);
  });
});
