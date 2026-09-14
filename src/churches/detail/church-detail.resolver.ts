import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { Church } from '../../shared/models';

export const churchDetailResolver: ResolveFn<Church | null> = (
  route: ActivatedRouteSnapshot,
): Observable<Church | null> => {
  const slug = route.paramMap.get('slug');
  if (slug === null) {
    return of(null);
  }
  return inject(ChurchApiService)
    .getChurchBySlug(slug)
    .pipe(catchError(() => of(null)));
};
