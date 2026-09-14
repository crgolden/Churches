import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { churchListResolver, DEFAULT_PAGE_SIZE, searchParamsFrom } from './church-list.resolver';
import { ChurchApiService } from '../../shared/church.service';
import { SearchPagedResult } from '../../shared/models';

const RESULTS = { items: [], totalCount: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE } as SearchPagedResult;

function run(
  api: Partial<ChurchApiService>,
  queryParams: Record<string, string>,
): Promise<SearchPagedResult | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ChurchApiService, useValue: api }] });

  const route = { queryParams } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (churchListResolver(route, {} as never) as Observable<SearchPagedResult | null>).subscribe(
        resolvePromise,
      );
    });
  });
}

describe('searchParamsFrom', () => {
  it('defaults the page and page size when the URL carries neither', () => {
    const params = searchParamsFrom({});

    expect(params['page']).toBe(1);
    expect(params['pageSize']).toBe(DEFAULT_PAGE_SIZE);
  });

  it('takes the page and page size from the URL, so a deep link lands where it says', () => {
    const requestedPage = 4;
    const requestedPageSize = 50;

    const params = searchParamsFrom({
      page: String(requestedPage),
      pageSize: String(requestedPageSize),
    });

    expect(params['page']).toBe(requestedPage);
    expect(params['pageSize']).toBe(requestedPageSize);
  });

  it('sends nothing for a filter the reader cleared, exactly as for one never set', () => {
    const cleared = searchParamsFrom({ denominationId: '', sort: '', startTimeAfter: '' });
    const neverSet = searchParamsFrom({});

    expect(cleared['denominationId']).toBeUndefined();
    expect(cleared['sort']).toBeUndefined();
    expect(cleared['startTimeAfter']).toBeUndefined();
    expect(neverSet['denominationId']).toBeUndefined();
    expect(neverSet['sort']).toBeUndefined();
    expect(neverSet['startTimeAfter']).toBeUndefined();
  });

  it('reads the accessibility filter as a boolean, including its false case', () => {
    expect(searchParamsFrom({ wheelchairAccessible: 'true' })['wheelchairAccessible']).toBe(true);
    expect(searchParamsFrom({ wheelchairAccessible: 'false' })['wheelchairAccessible']).toBe(false);
    expect(searchParamsFrom({})['wheelchairAccessible']).toBeUndefined();
  });
});

describe('churchListResolver', () => {
  it('resolves the page the query parameters describe', async () => {
    const result = await run({ search: () => of(RESULTS) }, { page: '2' });

    expect(result).toBe(RESULTS);
  });

  it('passes the query parameters through to the api', async () => {
    const requestedPage = 3;
    let received: Record<string, unknown> | null = null;

    await run(
      {
        search: (params: Record<string, unknown>) => {
          received = params;
          return of(RESULTS);
        },
      },
      { page: String(requestedPage), q: 'grace' },
    );

    expect(received).not.toBeNull();
    expect((received as unknown as Record<string, unknown>)['page']).toBe(requestedPage);
    expect((received as unknown as Record<string, unknown>)['q']).toBe('grace');
  });

  it('degrades to null so the route still activates and the page can say so', async () => {
    const result = await run({ search: () => throwError(() => new Error('boom')) }, {});

    expect(result).toBeNull();
  });
});
