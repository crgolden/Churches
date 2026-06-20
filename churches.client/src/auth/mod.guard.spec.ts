import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { modGuard } from './mod.guard';
import { AuthService } from './auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

describe('modGuard', () => {
  const runGuard = () =>
    TestBed.runInInjectionContext(() => modGuard({} as never, {} as never));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('returns true when user has moderation scope', () => {
    const auth = TestBed.inject(AuthService);
    Object.defineProperty(auth, 'hasModerationScope', { value: signal(true) });
    expect(runGuard()).toBe(true);
  });

  it('returns UrlTree to root when user lacks moderation scope', () => {
    const auth = TestBed.inject(AuthService);
    Object.defineProperty(auth, 'hasModerationScope', { value: signal(false) });
    const result = runGuard();
    expect(result).toBeInstanceOf(UrlTree);
  });
});
