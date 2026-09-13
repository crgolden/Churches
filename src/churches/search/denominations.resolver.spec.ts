import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { denominationsResolver } from './denominations.resolver';
import { ChurchApiService } from '../../shared/church.service';
import { Denomination } from '../../shared/models';

const DENOMINATIONS = [{ id: 'd1', name: 'Baptist' }] as unknown as Denomination[];

function run(api: Partial<ChurchApiService>): Promise<Denomination[]> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ChurchApiService, useValue: api }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (denominationsResolver({} as never, {} as never) as Observable<Denomination[]>).subscribe(
        resolvePromise,
      );
    });
  });
}

describe('denominationsResolver', () => {
  it('resolves the filter vocabulary the search form renders', async () => {
    const result = await run({ getDenominations: () => of(DENOMINATIONS) });

    expect(result).toBe(DENOMINATIONS);
  });

  it('degrades to an empty list, so a failed lookup leaves a usable form rather than no page', async () => {
    const result = await run({ getDenominations: () => throwError(() => new Error('boom')) });

    expect(result).toEqual([]);
  });
});
