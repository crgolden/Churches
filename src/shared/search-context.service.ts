import { Injectable, Signal, signal } from '@angular/core';
import { Params } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SearchContextService {
  private readonly _lastSearch = signal<Params>({});

  public readonly lastSearch: Signal<Params> = this._lastSearch.asReadonly();

  public remember(params: Params): void {
    this._lastSearch.set({ ...params });
  }
}
