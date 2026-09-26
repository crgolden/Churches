import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { SearchPagedResult, SearchParams } from '../../shared/models';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../../shared/directory-api';

function omitBlank(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

function numberOrUndefined(value: string | undefined): number | undefined {
  return value ? +value : undefined;
}

export function searchParamsFrom(params: Record<string, string | undefined>): SearchParams {
  const wheelchairAccessible = params[SearchParamNames.wheelchairAccessible];
  return {
    q: params[SearchParamNames.q],
    state: params[SearchParamNames.state],
    lat: numberOrUndefined(params[SearchParamNames.lat]),
    lng: numberOrUndefined(params[SearchParamNames.lng]),
    radiusMiles: numberOrUndefined(params[SearchParamNames.radiusMiles]),
    denominationId: omitBlank(params[SearchParamNames.denominationId]),
    worshipStyle: numberOrUndefined(params[SearchParamNames.worshipStyle]),
    wheelchairAccessible: wheelchairAccessible != null ? wheelchairAccessible === 'true' : undefined,
    dayOfWeek: numberOrUndefined(params[SearchParamNames.dayOfWeek]),
    startTimeAfter: omitBlank(params[SearchParamNames.startTimeAfter]),
    startTimeBefore: omitBlank(params[SearchParamNames.startTimeBefore]),
    sort: omitBlank(params[SearchParamNames.sort]),
    page: +(params[SearchParamNames.page] ?? 1),
    pageSize: +(params[SearchParamNames.pageSize] ?? DEFAULT_PAGE_SIZE),
  };
}

export const churchListResolver: ResolveFn<SearchPagedResult | null> = (
  route: ActivatedRouteSnapshot,
): Observable<SearchPagedResult | null> =>
  inject(ChurchApiService)
    .search(searchParamsFrom(route.queryParams as Record<string, string | undefined>))
    .pipe(catchError(() => of(null)));
