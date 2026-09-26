import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';

export const churchCountResolver: ResolveFn<number | null> = (): Observable<number | null> =>
  inject(ChurchApiService)
    .search({ page: 1, pageSize: 1 })
    .pipe(
      map(result => result.totalCount),
      catchError(() => of(null)),
    );
