import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { newCount, newText } from '@crgolden/modules/testing';
import { moderationResolver, PENDING_STATUS } from './moderation.resolver';
import { ChurchApiService } from '../../shared/church.service';
import { PagedResult, UserCorrection } from '../../shared/models';

const CORRECTIONS = { items: [], totalCount: 0 } as unknown as PagedResult<UserCorrection>;

function routeAskingFor(page: string | null): ActivatedRouteSnapshot {
  return { queryParamMap: convertToParamMap(page === null ? {} : { page }) } as ActivatedRouteSnapshot;
}

function run(
  api: Partial<ChurchApiService>,
  route: ActivatedRouteSnapshot = routeAskingFor(null),
): Promise<PagedResult<UserCorrection> | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ChurchApiService, useValue: api }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (
        moderationResolver(route, {} as never) as Observable<PagedResult<UserCorrection> | null>
      ).subscribe(resolvePromise);
    });
  });
}

describe('moderationResolver', () => {
  it('resolves the queue the moderation page renders', async () => {
    const result = await run({ getCorrections: () => of(CORRECTIONS) });

    expect(result).toBe(CORRECTIONS);
  });

  it('asks only for corrections still awaiting a decision', async () => {
    let requestedStatus: number | undefined;

    await run({
      getCorrections: (status: number) => {
        requestedStatus = status;
        return of(CORRECTIONS);
      },
    });

    expect(requestedStatus).toBe(PENDING_STATUS);
  });

  it('degrades to null so the route activates and the page reports the failure', async () => {
    const result = await run({ getCorrections: () => throwError(() => new Error(newText())) });

    expect(result).toBeNull();
  });

  it('asks for the page the URL names', async () => {
    let requestedPage: number | undefined;
    const askedFor = newCount() + 1;

    await run(
      {
        getCorrections: (_status: number, page: number) => {
          requestedPage = page;
          return of(CORRECTIONS);
        },
      },
      routeAskingFor(String(askedFor)),
    );

    expect(requestedPage).toBe(askedFor);
  });

  it('falls back to the first page when the URL names nothing usable', async () => {
    let requestedPage: number | undefined;

    await run(
      {
        getCorrections: (_status: number, page: number) => {
          requestedPage = page;
          return of(CORRECTIONS);
        },
      },
      routeAskingFor(newText()),
    );

    expect(requestedPage).toBe(1);
  });
});
