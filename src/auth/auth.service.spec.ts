import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import type { Claim } from './claim';

describe('AuthService', () => {
  let service: AuthService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
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
    const claims: Claim[] = [{ type: 'name', value: 'Alice' }];
    service.initialize().subscribe();
    controller.expectOne('bff/user').flush(claims);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.username()).toBe('Alice');
  });

  it('session returns empty array when unauthenticated', () => {
    expect(service.session()).toEqual([]);
  });

  it('hasModerationScope returns true when claim present', () => {
    const claims: Claim[] = [{ type: 'churches.mod', value: 'true' }];
    service.initialize().subscribe();
    controller.expectOne('bff/user').flush(claims);
    expect(service.hasModerationScope()).toBe(true);
  });

  it('hasModerationScope returns false when claim absent', () => {
    const claims: Claim[] = [{ type: 'name', value: 'Bob' }];
    service.initialize().subscribe();
    controller.expectOne('bff/user').flush(claims);
    expect(service.hasModerationScope()).toBe(false);
  });

  it('logoutUrl returns the bff:logout_url claim value when authenticated', () => {
    const claims: Claim[] = [{ type: 'bff:logout_url', value: '/bff/logout?sid=abc' }];
    service.initialize().subscribe();
    controller.expectOne('bff/user').flush(claims);
    expect(service.logoutUrl()).toBe('/bff/logout?sid=abc');
  });

  it('logoutUrl returns null when unauthenticated', () => {
    expect(service.logoutUrl()).toBeNull();
  });

  it('refresh re-fetches bff/user', () => {
    service.initialize().subscribe();
    controller.expectOne('bff/user').flush([]);
    service.refresh();
    controller.expectOne('bff/user').flush([{ type: 'name', value: 'Bob' }]);
    expect(service.username()).toBe('Bob');
  });

  it('initialize returns empty session when bff/user errors', () => {
    let result: Claim[] | null = null;
    service.initialize().subscribe(s => (result = s));
    controller.expectOne('bff/user').flush('', { status: 401, statusText: 'Unauthorized' });
    expect(result).toEqual([]);
  });
});
