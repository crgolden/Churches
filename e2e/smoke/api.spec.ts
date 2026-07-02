/**
 * Port of C# Smoke/ApiTests — exercises the deployed Churches app.
 *
 * All tests in this file are skipped unless SmokeBaseUrl is set.
 * Run via: npm run e2e:smoke (sets SmokeBaseUrl from environment).
 */

import { test, expect } from '@playwright/test';

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

function skipIfNotSmoke(): void {
  if (!smokeBaseUrl) {
    test.skip();
  }
}

test.describe('Smoke — deployed stack', () => {
  test('GET /health returns 200 Healthy', async ({ request }) => {
    skipIfNotSmoke();
    const res = await request.get(`${smokeBaseUrl}/health`);
    expect(res.status()).toBe(200);
    expect((await res.text()).trim()).toBe('Healthy');
  });

  test('SPA root bootstraps Angular app', async ({ page }) => {
    skipIfNotSmoke();
    await page.goto(`${smokeBaseUrl}/`);
    const content = page.locator('app-root > *');
    await content.first().waitFor({ state: 'attached' });
    expect(await content.count()).toBeGreaterThan(0);
  });

  test('BFF proxy without CSRF header returns 401', async ({ request }) => {
    skipIfNotSmoke();
    // Must be rejected when X-CSRF is absent — the BFF's core CSRF defence.
    const res = await request.get(`${smokeBaseUrl}/directory/api/search`);
    expect(res.status()).toBe(401);
  });

  test('BFF proxy with CSRF header reaches Directory and returns 200', async ({ request }) => {
    skipIfNotSmoke();
    const res = await request.get(`${smokeBaseUrl}/directory/api/search`, {
      headers: { 'X-CSRF': '1' },
    });
    expect(res.status()).toBe(200);
  });

  test('BFF protected endpoint unauthenticated returns 401', async ({ request }) => {
    skipIfNotSmoke();
    const res = await request.post(`${smokeBaseUrl}/directory/api/corrections`, {
      headers: { 'X-CSRF': '1', 'Content-Type': 'application/json' },
      data: JSON.stringify({ churchId: crypto.randomUUID(), field: 'street', newValue: 'x' }),
    });
    expect(res.status()).toBe(401);
  });
});
