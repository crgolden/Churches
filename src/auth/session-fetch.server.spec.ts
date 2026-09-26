import { TestBed } from '@angular/core/testing';
import { IS_DISCOVERING_ROUTES } from '@angular/ssr';
import { FETCHES_SESSION_ON_STARTUP } from './session-fetch';
import { noSessionFetchWhileDiscoveringRoutes } from './session-fetch.server';

describe('noSessionFetchWhileDiscoveringRoutes', () => {
  it('turns the startup session fetch off while the build discovers routes', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: IS_DISCOVERING_ROUTES, useValue: true }, noSessionFetchWhileDiscoveringRoutes],
    });

    expect(TestBed.inject(FETCHES_SESSION_ON_STARTUP)).toBe(false);
  });

  it('leaves the startup session fetch on when the server renders a request', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: IS_DISCOVERING_ROUTES, useValue: false }, noSessionFetchWhileDiscoveringRoutes],
    });

    expect(TestBed.inject(FETCHES_SESSION_ON_STARTUP)).toBe(true);
  });
});
