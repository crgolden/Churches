import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { REQUEST } from '@angular/core';
import { ssrAbsoluteUrlInterceptor } from './ssr-absolute-url.interceptor';

const SSR_ORIGIN = `https://${crypto.randomUUID()}.example.com:4000`;
const RELATIVE_PATH = `/${crypto.randomUUID()}/${crypto.randomUUID()}`;
const ABSOLUTE_URL = `https://${crypto.randomUUID()}.example.com${RELATIVE_PATH}`;

function configure(requestProviderValue: Request | null) {
  TestBed.configureTestingModule({
    providers: [
      { provide: REQUEST, useValue: requestProviderValue },
      provideHttpClient(withXhr(), withInterceptors([ssrAbsoluteUrlInterceptor])),
      provideHttpClientTesting(),
    ],
  });
}

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
      http.get(RELATIVE_PATH).subscribe();

      const req = controller.expectOne(RELATIVE_PATH);
      expect(req.request.url).toBe(RELATIVE_PATH);
      req.flush([]);
    });

    it('passes already-absolute URLs through unchanged', () => {
      http.get(ABSOLUTE_URL).subscribe();

      const req = controller.expectOne(ABSOLUTE_URL);
      expect(req.request.url).toBe(ABSOLUTE_URL);
      req.flush([]);
    });
  });

  describe('under SSR (REQUEST provided)', () => {
    beforeEach(() => {
      configure(new Request(`${SSR_ORIGIN}/${crypto.randomUUID()}`));
      http = TestBed.inject(HttpClient);
      controller = TestBed.inject(HttpTestingController);
    });

    it('rewrites a relative path to an absolute URL using the request origin', () => {
      http.get(RELATIVE_PATH).subscribe();

      const req = controller.expectOne((r) => r.url.startsWith(SSR_ORIGIN));
      expect(req.request.url).toBe(`${SSR_ORIGIN}${RELATIVE_PATH}`);
      req.flush([]);
    });

    it('adds a leading slash when the relative URL lacks one', () => {
      http.get(RELATIVE_PATH.substring(1)).subscribe();

      const req = controller.expectOne((r) => r.url.startsWith(SSR_ORIGIN));
      expect(req.request.url).toBe(`${SSR_ORIGIN}${RELATIVE_PATH}`);
      req.flush([]);
    });

    it('passes already-absolute URLs through even under SSR', () => {
      http.get(ABSOLUTE_URL).subscribe();

      const req = controller.expectOne(ABSOLUTE_URL);
      expect(req.request.url).toBe(ABSOLUTE_URL);
      req.flush([]);
    });
  });
});
