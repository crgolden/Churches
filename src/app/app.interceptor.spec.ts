import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, REQUEST } from '@angular/core';
import { newHostname, newHttpsAddress, newPathSegment, newText } from '@crgolden/modules/testing';
import { appInterceptor } from './app.interceptor';
import { AngularPlatforms } from '../testing/angular-constants';
import {
  BFF_USER_RELATIVE_PATH,
  COOKIE_HEADER,
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  REQUEST_ID_HEADER,
} from '../shared/bff-contract';
import { DirectoryApi } from '../shared/directory-api';
import { CHURCHES_URL } from './app-paths';

const RENDERED_ORIGIN = new URL(newHttpsAddress()).origin;
const SESSION_COOKIE = `${newText()}=${newText()}`;
const OWN_RELATIVE_PATH = `/${newPathSegment()}`;

function configureServerRender(): void {
  const rendered = new Request(`${RENDERED_ORIGIN}${CHURCHES_URL}`, {
    headers: { cookie: SESSION_COOKIE },
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: AngularPlatforms.server },
      { provide: REQUEST, useValue: rendered },
      provideHttpClient(withXhr(), withInterceptors([appInterceptor])),
      provideHttpClientTesting(),
    ],
  });
}

describe('appInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptors([appInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('adds X-CSRF header to outgoing requests', () => {
    http.get(OWN_RELATIVE_PATH).subscribe();
    const req = controller.expectOne(OWN_RELATIVE_PATH);
    expect(req.request.headers.get(CSRF_HEADER)).toBe(CSRF_HEADER_VALUE);
    req.flush({});
  });

  it('adds X-Request-ID header to outgoing requests', () => {
    http.get(OWN_RELATIVE_PATH).subscribe();
    const req = controller.expectOne(OWN_RELATIVE_PATH);
    expect(req.request.headers.has(REQUEST_ID_HEADER)).toBe(true);
    req.flush({});
  });

  it('sets withCredentials on outgoing requests', () => {
    http.get(OWN_RELATIVE_PATH).subscribe();
    const req = controller.expectOne(OWN_RELATIVE_PATH);
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('does not forward a cookie in the browser, where REQUEST is absent', () => {
    http.get(OWN_RELATIVE_PATH).subscribe();
    const req = controller.expectOne(OWN_RELATIVE_PATH);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush({});
  });
});

describe('appInterceptor under SSR', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    configureServerRender();
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('forwards the reader’s cookie to the app’s own origin', () => {
    const ownOrigin = `${RENDERED_ORIGIN}${DirectoryApi.churches}`;
    http.get(ownOrigin).subscribe();

    const req = controller.expectOne(ownOrigin);
    expect(req.request.headers.get(COOKIE_HEADER)).toBe(SESSION_COOKIE);
    req.flush([]);
  });

  it('withholds the reader’s cookie from any other origin', () => {
    const elsewhere = `${new URL(newHttpsAddress()).origin}${DirectoryApi.churches}`;
    http.get(elsewhere).subscribe();

    const req = controller.expectOne(elsewhere);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush([]);
  });

  it('withholds the reader’s cookie from a host that merely starts with the rendered origin', () => {
    const lookalike = `${RENDERED_ORIGIN}.${newHostname()}${DirectoryApi.churches}`;
    http.get(lookalike).subscribe();

    const req = controller.expectOne(lookalike);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush([]);
  });

  it('forwards the cookie to a relative URL, which can only resolve to our own origin', () => {
    http.get(BFF_USER_RELATIVE_PATH).subscribe();

    const req = controller.expectOne(BFF_USER_RELATIVE_PATH);
    expect(req.request.headers.get(COOKIE_HEADER)).toBe(SESSION_COOKIE);
    req.flush([]);
  });

  it('withholds the cookie from a protocol-relative URL, which is not our origin', () => {
    const protocolRelative = `//${newHostname()}${DirectoryApi.churches}`;
    http.get(protocolRelative).subscribe();

    const req = controller.expectOne(protocolRelative);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush([]);
  });
});
