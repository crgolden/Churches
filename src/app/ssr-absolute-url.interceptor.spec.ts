import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { REQUEST } from '@angular/core';
import { ssrAbsoluteUrlInterceptor } from './ssr-absolute-url.interceptor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function configure(requestProviderValue: Request | null) {
  TestBed.configureTestingModule({
    providers: [
      { provide: REQUEST, useValue: requestProviderValue },
      provideHttpClient(withInterceptors([ssrAbsoluteUrlInterceptor])),
      provideHttpClientTesting(),
    ],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ssrAbsoluteUrlInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  afterEach(() => controller.verify());

  describe('in the browser (REQUEST is null)', () => {
    beforeEach(() => {
      configure(null);
      http = TestBed.inject(HttpClient);
      controller = TestBed.inject(HttpTestingController);
    });

    it('passes relative URLs through unchanged', () => {
      http.get('/directory/api/churches').subscribe();

      const req = controller.expectOne('/directory/api/churches');
      expect(req.request.url).toBe('/directory/api/churches');
      req.flush([]);
    });

    it('passes already-absolute URLs through unchanged', () => {
      http.get('https://directory.example.com/api/churches').subscribe();

      const req = controller.expectOne('https://directory.example.com/api/churches');
      expect(req.request.url).toBe('https://directory.example.com/api/churches');
      req.flush([]);
    });
  });

  describe('under SSR (REQUEST provided)', () => {
    beforeEach(() => {
      configure(new Request('https://ssr-host.example.com:4000/churches'));
      http = TestBed.inject(HttpClient);
      controller = TestBed.inject(HttpTestingController);
    });

    it('rewrites a relative path to an absolute URL using the request origin', () => {
      http.get('/directory/api/churches').subscribe();

      const req = controller.expectOne(r => r.url.startsWith('https://ssr-host'));
      expect(req.request.url).toBe('https://ssr-host.example.com:4000/directory/api/churches');
      req.flush([]);
    });

    it('adds a leading slash when the relative URL lacks one', () => {
      http.get('directory/api/churches').subscribe();

      const req = controller.expectOne(r => r.url.startsWith('https://ssr-host'));
      expect(req.request.url).toBe('https://ssr-host.example.com:4000/directory/api/churches');
      req.flush([]);
    });

    it('passes already-absolute URLs through even under SSR', () => {
      http.get('https://external.example.com/api').subscribe();

      const req = controller.expectOne('https://external.example.com/api');
      expect(req.request.url).toBe('https://external.example.com/api');
      req.flush([]);
    });
  });
});
