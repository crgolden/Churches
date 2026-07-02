import { computed, Injectable, Signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, of, shareReplay, Subject, switchMap, take } from 'rxjs';
import { Claim } from './claim';

export type { Claim } from './claim';
export type Session = Claim[];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _refresh$ = new Subject<void>();

  private readonly _fetchResult$ = this._refresh$.pipe(
    switchMap(() =>
      this.http.get<Claim[]>('bff/user').pipe(
        catchError(() => of(null))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly _fetchResult = toSignal(this._fetchResult$, {
    initialValue: null as Claim[] | null
  });

  public readonly isAuthenticated: Signal<boolean> = computed(() => this._fetchResult() !== null);
  public readonly isAnonymous: Signal<boolean> = computed(() => this._fetchResult() === null);
  public readonly session: Signal<Session> = computed(() => this._fetchResult() ?? []);
  public readonly hasModerationScope: Signal<boolean> = computed(() =>
    this._fetchResult()?.some(x => x.type === 'churches.mod' && x.value === 'true') ?? false
  );
  public readonly username: Signal<string | null> = computed(
    () => this._fetchResult()?.find(x => x.type === 'name')?.value ?? null
  );
  public readonly logoutUrl: Signal<string | null> = computed(() => {
    const s = this._fetchResult();
    if (!s) return null;
    return s.find(x => x.type === 'bff:logout_url')?.value ?? null;
  });

  public readonly loginUrl: string = '/bff/login';

  public initialize(): Observable<Session> {
    // SEO routes are anonymous and rendered server-side; skip the BFF session
    // check on the server so cookies aren't forwarded into the render.
    if (isPlatformServer(this.platformId)) {
      return of([]);
    }

    this._refresh$.next();
    return this._fetchResult$.pipe(
      map(s => s ?? []),
      take(1)
    );
  }

  public refresh(): void {
    this._refresh$.next();
  }
}
