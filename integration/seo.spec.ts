import { test, expect } from '@playwright/test';
import { AngularSsrMarkers } from '../e2e/angular-ssr-constants.js';
import { churchesUrl, createTestStore, newChurchWithDetails } from '../e2e/test-data.js';
import { churchUrl } from '../src/app/app-paths';
import { SearchParamNames } from '../src/shared/directory-api';
import {
  CANONICAL_REL,
  JSON_LD_MIME_TYPE,
  MetaNames,
  MetaProperties,
  SchemaTypes,
} from '../src/shared/seo-contract';

test('the churches list page is server-rendered with its SEO tags', async ({ request }) => {
  const store = createTestStore();
  const church = newChurchWithDetails();
  await store.reset();
  await store.seedChurch(church);

  const response = await request.get(churchesUrl({ [SearchParamNames.q]: church.canonicalName }));
  const html = await response.text();

  expect(response.ok()).toBeTruthy();
  expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
  expect(html).toMatch(/<title[^>]*>/);
  expect(html).toContain(MetaProperties.ogTitle);
  expect(html).toContain(MetaNames.twitterCard);
});

test('a church page is server-rendered with its full SEO tags', async ({ request }) => {
  const store = createTestStore();
  const church = newChurchWithDetails();
  await store.reset();
  await store.seedChurch(church);

  const response = await request.get(churchUrl(church.slug));
  const html = await response.text();

  expect(response.ok()).toBeTruthy();
  expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
  expect(html).toContain(`data-church-id="${church.id}"`);
  expect(html).toMatch(/<title[^>]*>[^<]*\S[^<]*<\/title>/);
  expect(html).toContain(`name="${MetaNames.description}"`);
  expect(html).toContain(`rel="${CANONICAL_REL}"`);
  expect(html).toContain(MetaProperties.ogTitle);
  expect(html).toContain(MetaProperties.ogDescription);
  expect(html).toContain(MetaProperties.ogUrl);
  expect(html).toContain(MetaNames.twitterCard);
  expect(html).toContain(JSON_LD_MIME_TYPE);
  expect(html).toContain(`"${SchemaTypes.church}"`);
});
