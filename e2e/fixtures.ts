/**
 * Custom Playwright fixtures for the Churches E2E suite.
 *
 * Provides:
 *  - `store`          HTTP control client for seeding/clearing mock server state.
 *  - `anonymousPage`  Page with /bff/user mocked as 401 and /bff/login as a mock page.
 *  - `authedPage`     Page with /bff/user mocked with standard user claims.
 *  - `modPage`        Page with /bff/user mocked with moderator claims (churches.mod=true).
 */

import { test as base, type Page } from '@playwright/test';
import type { ChurchRecord, CorrectionRecord } from './mocks/directory.js';

export type { ChurchRecord, CorrectionRecord };

// ── Pre-built seed records (mirrors C# ChurchStore static fields) ─────────────

export const FIRST_BAPTIST_AUSTIN: ChurchRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  canonicalName: 'First Baptist Church Austin',
  slug: 'first-baptist-church-austin-tx',
  latitude: 30.2672,
  longitude: -97.7431,
  street: '901 Trinity St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  phoneNumber: '(512) 476-2625',
  website: 'https://fbcaustin.org',
  emailAddress: 'info@fbcaustin.org',
  denominationId: null,
  worshipStyle: 1,
  primaryLanguage: 'English',
  acceptsLGBTQ: null,
  wheelchairAccessible: true,
  hasNursery: true,
  hasYouthProgram: true,
  confidenceScore: 0.85,
  lastVerifiedAt: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schedules: [
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      churchId: '11111111-1111-1111-1111-111111111111',
      campusId: null,
      dayOfWeek: 0,
      startTime: '10:00:00',
      description: 'Sunday Worship',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000002',
      churchId: '11111111-1111-1111-1111-111111111111',
      campusId: null,
      dayOfWeek: 3,
      startTime: '19:00:00',
      description: 'Bible Study',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  ministries: [
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000001',
      churchId: '11111111-1111-1111-1111-111111111111',
      name: 'Youth Group',
      description: 'For teens',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000002',
      churchId: '11111111-1111-1111-1111-111111111111',
      name: 'Food Bank',
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  campuses: [
    {
      id: 'cccccccc-0000-0000-0000-000000000001',
      churchId: '11111111-1111-1111-1111-111111111111',
      name: 'North Campus',
      street: '1200 N Lamar Blvd',
      city: 'Austin',
      state: 'TX',
      zip: '78703',
      latitude: 30.29,
      longitude: -97.75,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

export const MOSAIC_AUSTIN: ChurchRecord = {
  id: '22222222-2222-2222-2222-222222222222',
  canonicalName: 'Mosaic Church Austin',
  slug: 'mosaic-church-austin-tx',
  latitude: 30.27,
  longitude: -97.75,
  street: null,
  city: 'Austin',
  state: 'TX',
  zip: '78702',
  phoneNumber: null,
  website: null,
  emailAddress: null,
  denominationId: null,
  worshipStyle: 2,
  primaryLanguage: 'English',
  acceptsLGBTQ: null,
  wheelchairAccessible: null,
  hasNursery: null,
  hasYouthProgram: null,
  confidenceScore: 0.2,
  lastVerifiedAt: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schedules: [],
  ministries: [],
  campuses: [],
};

// ── Mock server control client ────────────────────────────────────────────────

const MOCK_BASE = 'http://localhost:4001';

export interface TestStore {
  reset(): Promise<void>;
  seedChurch(church: ChurchRecord): Promise<void>;
  seedCorrection(correction: Omit<CorrectionRecord, 'createdAt'> & { createdAt?: string }): Promise<void>;
}

async function fetchControl(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${MOCK_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Control API ${path} returned ${res.status}`);
  }
}

// ── Anonymous and authenticated claim payloads ────────────────────────────────

const USER_CLAIMS = [
  { type: 'sub', value: 'e2e-user-id' },
  { type: 'email', value: 'e2e@test.invalid' },
  { type: 'name', value: 'e2e@test.invalid' },
  { type: 'bff:logout_url', value: '/bff/logout?sid=e2e' },
  { type: 'bff:session_expires_in', value: '3600' },
];

const MOD_CLAIMS = [
  ...USER_CLAIMS,
  { type: 'churches.mod', value: 'true' },
];

// ── Route mock helpers ────────────────────────────────────────────────────────

async function applyAnonymousRoutes(page: Page): Promise<void> {
  await page.route('**/bff/user**', route =>
    route.fulfill({ status: 401 }),
  );
  await page.route('**/bff/login**', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><p>Login page (mock)</p></body></html>',
    }),
  );
}

async function applyAuthRoutes(page: Page, claims: typeof USER_CLAIMS): Promise<void> {
  await page.route('**/bff/user**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(claims),
    }),
  );
  await page.route('**/bff/logout**', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><p>Logged out (mock)</p></body></html>',
    }),
  );
}

// ── Fixture type ──────────────────────────────────────────────────────────────

type ChurchesFixtures = {
  store: TestStore;
  anonymousPage: Page;
  authedPage: Page;
  modPage: Page;
};

// ── Extended test instance ────────────────────────────────────────────────────

export const test = base.extend<ChurchesFixtures>({
  store: async ({}, use) => {
    const s: TestStore = {
      async reset() {
        await fetchControl('/_test/reset');
      },
      async seedChurch(church) {
        await fetchControl('/_test/churches', church);
      },
      async seedCorrection(correction) {
        await fetchControl('/_test/corrections', {
          ...correction,
          createdAt: correction.createdAt ?? new Date().toISOString(),
        });
      },
    };
    await use(s);
  },

  anonymousPage: async ({ page }, use) => {
    await applyAnonymousRoutes(page);
    page.setDefaultTimeout(60_000);
    await use(page);
  },

  authedPage: async ({ page }, use) => {
    await applyAuthRoutes(page, USER_CLAIMS);
    page.setDefaultTimeout(60_000);
    await use(page);
  },

  modPage: async ({ page }, use) => {
    await applyAuthRoutes(page, MOD_CLAIMS);
    page.setDefaultTimeout(60_000);
    await use(page);
  },
});

export { expect } from '@playwright/test';
