import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { PagedResult, UserCorrection } from '../../shared/models';

export const PENDING_STATUS = 0;

export const moderationResolver: ResolveFn<PagedResult<UserCorrection> | null> = (
  route: ActivatedRouteSnapshot,
): Observable<PagedResult<UserCorrection> | null> => {
  const requestedPage = Number(route.queryParamMap.get('page'));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return inject(ChurchApiService)
    .getCorrections(PENDING_STATUS, page)
    .pipe(catchError(() => of(null)));
};
