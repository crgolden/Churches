import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { churchDetailResolver } from './church-detail.resolver';
import { ChurchApiService } from '../../shared/church.service';
import { Church } from '../../shared/models';

const CHURCH = { canonicalName: 'Grace Chapel', slug: 'grace-chapel-austin-tx' } as unknown as Church;

function run(api: Partial<ChurchApiService>, slug: string | null): Promise<Church | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ChurchApiService, useValue: api }] });

  const route = { paramMap: { get: () => slug } } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (churchDetailResolver(route, {} as never) as Observable<Church | null>).subscribe(resolvePromise);
    });
  });
}

describe('churchDetailResolver', () => {
  it('resolves the church the slug names', async () => {
    const result = await run({ getChurchBySlug: () => of(CHURCH) }, CHURCH.slug);

    expect(result).toBe(CHURCH);
  });

  it('degrades to null rather than redirecting, so the detail page keeps the URL and renders 404', async () => {
    const result = await run({ getChurchBySlug: () => throwError(() => new Error('missing')) }, 'gone');

    expect(result).toBeNull();
  });

  it('resolves null for a missing slug without calling the api', async () => {
    let called = false;
    const result = await run(
      {
        getChurchBySlug: () => {
          called = true;
          return of(CHURCH);
        },
      },
      null,
    );

    expect(result).toBeNull();
    expect(called).toBe(false);
  });
});
