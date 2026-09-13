import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY, Observable } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { Church } from '../../shared/models';

/**
 * Correcting a church that cannot be loaded has no page to render, so this route redirects rather
 * than degrading to an inline state. The redirect lives here, not in the component, so the
 * component neither fetches nor navigates.
 */
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
