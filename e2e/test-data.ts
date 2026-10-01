import type { Page } from '@playwright/test';
import {
  LARGEST_PERCENT,
  newDisplayName,
  newEmailAddress,
  newHttpsAddress,
  newId,
  newMemberOf,
  newPathSegment,
  newPercent,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import {
  ControlRoutes,
  type CampusRecord,
  type ChurchRecord,
  type CorrectionRecord,
  type MinistryRecord,
  type ScheduleRecord,
} from './mocks/directory.js';
import { e2eContract } from './mocks/e2e-contract.js';
import { MediaTypes } from './media-type-constants.js';
import { OidcClaimTypes } from './oidc-constants.js';
import { CHURCHES_URL } from '../src/app/app-paths';
import { CONTENT_TYPE_HEADER, HttpMethods } from '../src/bff/http-headers';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../src/shared/directory-api';
import { DAYS_OF_WEEK, US_STATES, WORSHIP_STYLES } from '../src/shared/models';
import { BffPaths, ClaimTypes, MODERATOR_CLAIM_VALUE, SID_QUERY_PARAMETER } from '../src/shared/bff-contract';

export type { ChurchRecord, CorrectionRecord };

function newLatitude(): number {
  return randomIntBetween(-89, 90);
}

function newLongitude(): number {
  return randomIntBetween(-179, 180);
}

function newStartTime(): string {
  return `${randomIntBetween(10, 24)}:${randomIntBetween(10, 60)}:${randomIntBetween(10, 60)}`;
}

function newSchedule(churchId: string): ScheduleRecord {
  return {
    id: newId(),
    churchId,
    campusId: null,
    dayOfWeek: newMemberOf(DAYS_OF_WEEK).value,
    startTime: newStartTime(),
    description: newDisplayName(),
    createdAt: newUtcInstant(),
    updatedAt: newUtcInstant(),
  };
}

function newMinistry(churchId: string, description: string | null): MinistryRecord {
  return {
    id: newId(),
    churchId,
    name: newDisplayName(),
    description,
    createdAt: newUtcInstant(),
    updatedAt: newUtcInstant(),
  };
}

function newCampus(churchId: string): CampusRecord {
  return {
    id: newId(),
    churchId,
    name: newDisplayName(),
    street: newDisplayName(),
    city: newText(),
    state: newMemberOf(US_STATES).code,
    zip: newText(),
    latitude: newLatitude(),
    longitude: newLongitude(),
    createdAt: newUtcInstant(),
    updatedAt: newUtcInstant(),
  };
}

export function newChurchWithoutDetails(): ChurchRecord {
  return {
    id: newId(),
    canonicalName: newDisplayName(),
    slug: `${newPathSegment()}-${newPathSegment()}`,
    latitude: newLatitude(),
    longitude: newLongitude(),
    street: null,
    city: newText(),
    state: newMemberOf(US_STATES).code,
    zip: newText(),
    phoneNumber: null,
    website: null,
    emailAddress: null,
    denominationId: null,
    worshipStyle: newMemberOf(WORSHIP_STYLES).value,
    primaryLanguage: newText(),
    acceptsLGBTQ: null,
    wheelchairAccessible: null,
    hasNursery: null,
    hasYouthProgram: null,
    confidenceScore: newPercent() / LARGEST_PERCENT,
    lastVerifiedAt: null,
    isActive: true,
    createdAt: newUtcInstant(),
    updatedAt: newUtcInstant(),
    schedules: [],
    ministries: [],
    campuses: [],
  };
}

export function newChurchWithDetails(): ChurchRecord {
  const church = newChurchWithoutDetails();
  return {
    ...church,
    street: newDisplayName(),
    phoneNumber: newText(),
    website: newHttpsAddress(),
    emailAddress: newEmailAddress(),
    wheelchairAccessible: true,
    hasNursery: true,
    hasYouthProgram: true,
    schedules: [newSchedule(church.id), newSchedule(church.id)],
    ministries: [newMinistry(church.id, newDisplayName()), newMinistry(church.id, null)],
    campuses: [newCampus(church.id)],
  };
}

export function churchesUrl(query: Record<string, string>): string {
  return `${CHURCHES_URL}?${new URLSearchParams(query).toString()}`;
}

export function firstPageUrl(query: Record<string, string> = {}): string {
  return churchesUrl({
    ...query,
    [SearchParamNames.page]: String(1),
    [SearchParamNames.pageSize]: String(DEFAULT_PAGE_SIZE),
  });
}

export async function seedChurches(store: TestStore, count: number): Promise<void> {
  for (const church of Array.from({ length: count }, newChurchWithoutDetails)) {
    await store.seedChurch(church);
  }
}

export const CHURCH_WITH_DETAILS = newChurchWithDetails();

export const CHURCH_WITHOUT_DETAILS = newChurchWithoutDetails();

const USER_SUBJECT = newId();

export interface TestStore {
  reset(): Promise<void>;
  seedChurch(church: ChurchRecord): Promise<void>;
  seedCorrection(correction: Omit<CorrectionRecord, 'createdAt'> & { createdAt?: string }): Promise<void>;
}

function mockDirectoryAddress(): string {
  return `http://localhost:${e2eContract().mockDirectoryPort}`;
}

async function fetchControl(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${mockDirectoryAddress()}${path}`, {
    method: HttpMethods.post,
    headers: { [CONTENT_TYPE_HEADER]: MediaTypes.json },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Control API ${path} returned ${res.status}`);
  }
}

const USER_EMAIL = newEmailAddress();

interface Claim {
  type: string;
  value: string;
}

const USER_CLAIMS: Claim[] = [
  { type: ClaimTypes.subject, value: USER_SUBJECT },
  { type: OidcClaimTypes.email, value: USER_EMAIL },
  { type: ClaimTypes.name, value: USER_EMAIL },
  { type: ClaimTypes.logoutUrl, value: `${BffPaths.logout}?${SID_QUERY_PARAMETER}=${newText()}` },
];

const MOD_CLAIMS: Claim[] = [
  ...USER_CLAIMS,
  { type: ClaimTypes.moderator, value: MODERATOR_CLAIM_VALUE },
];

export async function signInAsVisitor(page: Page): Promise<void> {
  await page.route(`**${BffPaths.user}**`, route => route.fulfill({ json: null }));
  await page.route(`**${BffPaths.login}**`, route => route.fulfill({ body: newText() }));
}

async function signInWith(page: Page, claims: Claim[]): Promise<void> {
  await page.route(`**${BffPaths.user}**`, route => route.fulfill({ json: claims }));
  await page.route(`**${BffPaths.logout}**`, route => route.fulfill({ body: newText() }));
}

export async function signInAsMember(page: Page): Promise<void> {
  await signInWith(page, USER_CLAIMS);
}

export async function signInAsModerator(page: Page): Promise<void> {
  await signInWith(page, MOD_CLAIMS);
}

export function createTestStore(): TestStore {
  return {
    async reset() {
      await fetchControl(ControlRoutes.reset);
    },
    async seedChurch(church) {
      await fetchControl(ControlRoutes.churches, church);
    },
    async seedCorrection(correction) {
      await fetchControl(ControlRoutes.corrections, {
        ...correction,
        createdAt: correction.createdAt ?? new Date().toISOString(),
      });
    },
  };
}
