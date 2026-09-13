import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { Denomination } from '../../shared/models';

export const denominationsResolver: ResolveFn<Denomination[]> = (): Observable<Denomination[]> =>
  inject(ChurchApiService)
    .getDenominations()
    .pipe(catchError(() => of([] as Denomination[])));
