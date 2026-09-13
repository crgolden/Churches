import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { moderationResolver, PENDING_STATUS } from './moderation.resolver';
import { ChurchApiService } from '../../shared/church.service';
import { PagedResult, UserCorrection } from '../../shared/models';

const CORRECTIONS = { items: [], totalCount: 0 } as unknown as PagedResult<UserCorrection>;

function run(api: Partial<ChurchApiService>): Promise<PagedResult<UserCorrection> | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ChurchApiService, useValue: api }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (
        moderationResolver({} as never, {} as never) as Observable<PagedResult<UserCorrection> | null>
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
    const result = await run({ getCorrections: () => throwError(() => new Error('boom')) });

    expect(result).toBeNull();
  });
});
