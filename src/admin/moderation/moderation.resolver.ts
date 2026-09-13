import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { PagedResult, UserCorrection } from '../../shared/models';

export const PENDING_STATUS = 0;

export const moderationResolver: ResolveFn<PagedResult<UserCorrection> | null> = ()
  : Observable<PagedResult<UserCorrection> | null> =>
  inject(ChurchApiService)
    .getCorrections(PENDING_STATUS)
    .pipe(catchError(() => of(null)));
