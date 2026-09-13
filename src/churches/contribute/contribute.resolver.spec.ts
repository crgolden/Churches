import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { contributeChurchResolver } from './contribute.resolver';
import { ChurchApiService } from '../../shared/church.service';
import { Church } from '../../shared/models';

const CHURCH = { canonicalName: 'Grace Chapel', slug: 'grace-chapel-austin-tx' } as unknown as Church;

interface RunResult {
  emitted: Church[];
  navigatedTo: unknown[][];
}

function run(api: Partial<ChurchApiService>, slug: string | null): Promise<RunResult> {
  TestBed.resetTestingModule();
  const navigatedTo: unknown[][] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: ChurchApiService, useValue: api },
      {
        provide: Router,
        useValue: {
          navigate: (commands: unknown[]) => {
            navigatedTo.push(commands);
            return Promise.resolve(true);
          },
        },
      },
    ],
  });

  const route = { paramMap: { get: () => slug } } as unknown as ActivatedRouteSnapshot;
  const emitted: Church[] = [];

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (contributeChurchResolver(route, {} as never) as Observable<Church>).subscribe({
        next: (church) => emitted.push(church),
        complete: () => resolvePromise({ emitted, navigatedTo }),
      });
    });
  });
}

describe('contributeChurchResolver', () => {
  it('resolves the church being corrected', async () => {
    const { emitted, navigatedTo } = await run({ getChurchBySlug: () => of(CHURCH) }, CHURCH.slug);

    expect(emitted).toEqual([CHURCH]);
    expect(navigatedTo).toEqual([]);
  });

  it('redirects home and emits nothing when the church cannot be loaded', async () => {
    const { emitted, navigatedTo } = await run(
      { getChurchBySlug: () => throwError(() => new Error('missing')) },
      'gone',
    );

    expect(emitted).toEqual([]);
    expect(navigatedTo).toEqual([['/']]);
  });

  it('redirects home for a missing slug without calling the api', async () => {
    let called = false;
    const { emitted, navigatedTo } = await run(
      {
        getChurchBySlug: () => {
          called = true;
          return of(CHURCH);
        },
      },
      null,
    );

    expect(called).toBe(false);
    expect(emitted).toEqual([]);
    expect(navigatedTo).toEqual([['/']]);
  });
});
