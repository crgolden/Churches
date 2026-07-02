import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { REQUEST } from '@angular/core';
import { injectOrigin } from './origin';

// The DOCUMENT mock simulates what jsdom provides: document.location.origin.
const BROWSER_ORIGIN = 'https://churches.example.com';

describe('injectOrigin', () => {
  describe('under SSR (REQUEST token provided)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: REQUEST,
            useValue: new Request('https://ssr-host.example.com:4000/churches/grace'),
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
      expect(origin).toBe('https://ssr-host.example.com:4000');
    });
  });

  describe('in the browser (REQUEST token not provided)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          // REQUEST not provided — inject returns null (optional: true)
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
