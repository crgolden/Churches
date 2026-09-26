import { computed, Injectable, Signal, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, take, tap } from 'rxjs';
import { Claim } from './claim';
import { FETCHES_SESSION_ON_STARTUP } from './session-fetch';
import { BFF_USER_RELATIVE_PATH, BffPaths, ClaimTypes, MODERATOR_CLAIM_VALUE } from '../shared/bff-contract';

export type { Claim } from './claim';
export type Session = Claim[];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly fetchesSessionOnStartup = inject(FETCHES_SESSION_ON_STARTUP);
  private readonly _session = signal<Claim[] | null>(null);

  public readonly isAuthenticated: Signal<boolean> = computed(() => this._session() !== null);
  public readonly isAnonymous: Signal<boolean> = computed(() => this._session() === null);
  public readonly session: Signal<Session> = computed(() => this._session() ?? []);
  public readonly hasModerationScope: Signal<boolean> = computed(() =>
    this._session()?.some(x => x.type === ClaimTypes.moderator && x.value === MODERATOR_CLAIM_VALUE) ?? false
  );
  public readonly username: Signal<string | null> = computed(
    () => this._session()?.find(x => x.type === ClaimTypes.name)?.value ?? null
  );
  public readonly logoutUrl: Signal<string | null> = computed(
    () => this._session()?.find(x => x.type === ClaimTypes.logoutUrl)?.value ?? null
  );

  public readonly loginUrl: string = BffPaths.login;

  public initialize(): Observable<Session> {
    return this.fetchesSessionOnStartup ? this.fetchSession() : of([]);
  }

  public refresh(): void {
    this.fetchSession().subscribe();
  }

  private fetchSession(): Observable<Session> {
    return this.http.get<Claim[] | null>(BFF_USER_RELATIVE_PATH).pipe(
      catchError(() => of(null)),
      tap(claims => this._session.set(claims)),
      map(claims => claims ?? []),
      take(1),
    );
  }
}
