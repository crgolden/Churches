import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { SearchPagedResult } from '../../shared/models';

export const DEFAULT_PAGE_SIZE = 20;

function omitBlank(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

export function searchParamsFrom(params: Record<string, string | undefined>): Record<string, unknown> {
  return {
    q: params['q'],
    state: params['state'],
    lat: params['lat'] ? +params['lat'] : undefined,
    lng: params['lng'] ? +params['lng'] : undefined,
    radiusMiles: params['radiusMiles'] ? +params['radiusMiles'] : undefined,
    denominationId: omitBlank(params['denominationId']),
    worshipStyle: params['worshipStyle'] ? +params['worshipStyle'] : undefined,
    wheelchairAccessible:
      params['wheelchairAccessible'] != null ? params['wheelchairAccessible'] === 'true' : undefined,
    dayOfWeek: params['dayOfWeek'] ? +params['dayOfWeek'] : undefined,
    startTimeAfter: omitBlank(params['startTimeAfter']),
    startTimeBefore: omitBlank(params['startTimeBefore']),
    sort: omitBlank(params['sort']),
    page: +(params['page'] ?? 1),
    pageSize: +(params['pageSize'] ?? DEFAULT_PAGE_SIZE),
  };
}

export const churchListResolver: ResolveFn<SearchPagedResult | null> = (
  route: ActivatedRouteSnapshot,
): Observable<SearchPagedResult | null> =>
  inject(ChurchApiService)
    .search(searchParamsFrom(route.queryParams as Record<string, string | undefined>) as never)
    .pipe(catchError(() => of(null)));
