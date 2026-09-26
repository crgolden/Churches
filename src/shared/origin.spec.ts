import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { REQUEST } from '@angular/core';
import { injectOrigin } from './origin';

const BROWSER_ORIGIN = `https://${crypto.randomUUID()}.example.com`;
const SSR_ORIGIN = `https://${crypto.randomUUID()}.example.com:4000`;

describe('injectOrigin', () => {
  describe('under SSR (REQUEST token provided)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: REQUEST,
            useValue: new Request(`${SSR_ORIGIN}/${crypto.randomUUID()}`),
          },
          {
            provide: DOCUMENT,
            useValue: { location: { origin: BROWSER_ORIGIN } },
          },
        ],
      });
    });

    it('returns the origin from the server-side Request URL', () => {
      const origin = TestBed.runInInjectionContext(() => injectOrigin());
      expect(origin).toBe(SSR_ORIGIN);
    });
  });

  describe('in the browser (REQUEST token not provided)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: DOCUMENT,
            useValue: { location: { origin: BROWSER_ORIGIN } },
          },
        ],
      });
    });

    it('returns document.location.origin', () => {
      const origin = TestBed.runInInjectionContext(() => injectOrigin());
      expect(origin).toBe(BROWSER_ORIGIN);
    });
  });
});
