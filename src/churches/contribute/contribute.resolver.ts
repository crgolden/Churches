import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY, Observable } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { Church } from '../../shared/models';

export const contributeChurchResolver: ResolveFn<Church> = (
  route: ActivatedRouteSnapshot,
): Observable<Church> => {
  const router = inject(Router);
  const slug = route.paramMap.get('slug');
  if (slug === null) {
    void router.navigate(['/']);
    return EMPTY;
  }
  return inject(ChurchApiService)
    .getChurchBySlug(slug)
    .pipe(
      catchError(() => {
        void router.navigate(['/']);
        return EMPTY;
      }),
    );
};
