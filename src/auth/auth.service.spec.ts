import { TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransferState } from '@angular/core';
import { AuthService } from './auth.service';
import type { Claim } from './claim';
import { FETCHES_SESSION_ON_STARTUP } from './session-fetch';
import { BFF_USER_RELATIVE_PATH, BffPaths, ClaimTypes, MODERATOR_CLAIM_VALUE, SID_QUERY_PARAMETER } from '../shared/bff-contract';

const ALICE = crypto.randomUUID();
const BOB = crypto.randomUUID();

describe('AuthService', () => {
  let service: AuthService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('isAuthenticated returns false before initialize', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('isAnonymous returns true before initialize', () => {
    expect(service.isAnonymous()).toBe(true);
  });

  it('initialize fetches bff/user and updates signals', () => {
    const claims: Claim[] = [{ type: ClaimTypes.name, value: ALICE }];
    service.initialize().subscribe();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush(claims);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.username()).toBe(ALICE);
  });

  it('session returns empty array when unauthenticated', () => {
    expect(service.session()).toEqual([]);
  });

  it('hasModerationScope returns true when claim present', () => {
    const claims: Claim[] = [{ type: ClaimTypes.moderator, value: MODERATOR_CLAIM_VALUE }];
    service.initialize().subscribe();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush(claims);
    expect(service.hasModerationScope()).toBe(true);
  });

  it('hasModerationScope returns false when claim absent', () => {
    const claims: Claim[] = [{ type: ClaimTypes.name, value: BOB }];
    service.initialize().subscribe();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush(claims);
    expect(service.hasModerationScope()).toBe(false);
  });

  it('logoutUrl returns the bff:logout_url claim value when authenticated', () => {
    const logoutUrl = `${BffPaths.logout}?${SID_QUERY_PARAMETER}=${crypto.randomUUID()}`;
    const claims: Claim[] = [{ type: ClaimTypes.logoutUrl, value: logoutUrl }];
    service.initialize().subscribe();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush(claims);
    expect(service.logoutUrl()).toBe(logoutUrl);
  });

  it('logoutUrl returns null when unauthenticated', () => {
    expect(service.logoutUrl()).toBeNull();
  });

  it('refresh re-fetches bff/user', () => {
    service.initialize().subscribe();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush([]);
    service.refresh();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.name, value: BOB }]);
    expect(service.username()).toBe(BOB);
  });

  it('asks bff/user for the session and never carries it through TransferState', () => {
    const claims: Claim[] = [{ type: ClaimTypes.name, value: ALICE }];

    service.initialize().subscribe();
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush(claims);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.username()).toBe(ALICE);

    const transferred = TestBed.inject(TransferState).toJson();
    expect(transferred).not.toContain(ALICE);
  });

  it('treats the null body bff/user answers an anonymous visitor with as signed out', () => {
    let result: Claim[] | null = null;
    service.initialize().subscribe((s) => (result = s));
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush(null);
    expect(service.isAnonymous()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(result).toEqual([]);
  });

  it('fetches the session by default, so a browser and a rendered request both ask bff/user', () => {
    expect(TestBed.inject(FETCHES_SESSION_ON_STARTUP)).toBe(true);
  });

  it('initialize returns empty session when bff/user errors', () => {
    let result: Claim[] | null = null;
    service.initialize().subscribe((s) => (result = s));
    controller.expectOne(BFF_USER_RELATIVE_PATH).flush('', { status: HttpStatusCode.Unauthorized, statusText: crypto.randomUUID() });
    expect(result).toEqual([]);
  });
});

describe('AuthService while the startup session fetch is off', () => {
  let service: AuthService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: FETCHES_SESSION_ON_STARTUP, useValue: false },
      ],
    });
    service = TestBed.inject(AuthService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('initialize asks bff/user nothing and leaves the visitor anonymous', () => {
    let result: Claim[] | null = null;
    service.initialize().subscribe((s) => (result = s));
    controller.expectNone(BFF_USER_RELATIVE_PATH);
    expect(result).toEqual([]);
    expect(service.isAnonymous()).toBe(true);
  });
});
