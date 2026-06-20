import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { appInterceptor } from './app.interceptor';

describe('appInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([appInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('adds X-CSRF header to outgoing requests', () => {
    http.get('/test').subscribe();
    const req = controller.expectOne('/test');
    expect(req.request.headers.get('X-CSRF')).toBe('1');
    req.flush({});
  });

  it('adds X-Request-ID header to outgoing requests', () => {
    http.get('/test').subscribe();
    const req = controller.expectOne('/test');
    expect(req.request.headers.has('X-Request-ID')).toBe(true);
    req.flush({});
  });

  it('sets withCredentials on outgoing requests', () => {
    http.get('/test').subscribe();
    const req = controller.expectOne('/test');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });
});
