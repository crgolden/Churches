import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

describe('authGuard', () => {
  const runGuard = () =>
    TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('returns true when user is authenticated', () => {
    const auth = TestBed.inject(AuthService);
    Object.defineProperty(auth, 'isAuthenticated', { value: signal(true) });
    const result = runGuard();
    expect(result).toBe(true);
  });

  it('returns false and redirects when user is not authenticated', () => {
    const auth = TestBed.inject(AuthService);
    Object.defineProperty(auth, 'isAuthenticated', { value: signal(false) });
    const result = runGuard();
    expect(result).toBe(false);
  });
});
