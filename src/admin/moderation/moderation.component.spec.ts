import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ModerationComponent } from './moderation.component';
import { ChurchApiService } from '../../shared/church.service';
import { PagedResult, UserCorrection } from '../../shared/models';

function newCorrection(): UserCorrection {
  return {
    id: crypto.randomUUID(),
    churchId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    field: crypto.randomUUID(),
    oldValue: crypto.randomUUID(),
    newValue: crypto.randomUUID(),
    status: 0,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    churchName: crypto.randomUUID(),
  };
}

function pageOf(items: UserCorrection[]): PagedResult<UserCorrection> {
  return { items, totalCount: items.length } as unknown as PagedResult<UserCorrection>;
}

interface Harness {
  fixture: ComponentFixture<ModerationComponent>;
  refetches: number;
  approved: string[];
  rejected: string[];
}

function createHarness(resolved: PagedResult<UserCorrection> | null): Harness {
  const harness: Harness = {
    fixture: undefined as unknown as ComponentFixture<ModerationComponent>,
    refetches: 0,
    approved: [],
    rejected: [],
  };

  const api: Partial<ChurchApiService> = {
    getCorrections: (): Observable<PagedResult<UserCorrection>> => {
      harness.refetches += 1;
      return of(pageOf([]));
    },
    approveCorrection: (id: string): Observable<void> => {
      harness.approved.push(id);
      return of(undefined);
    },
    rejectCorrection: (id: string): Observable<void> => {
      harness.rejected.push(id);
      return of(undefined);
    },
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ModerationComponent],
    providers: [
      provideRouter([]),
      { provide: ChurchApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { corrections: resolved } } } },
    ],
  });

  harness.fixture = TestBed.createComponent(ModerationComponent);
  harness.fixture.detectChanges();
  return harness;
}

function click(harness: Harness, id: string): void {
  const button = harness.fixture.nativeElement.querySelector(id) as HTMLButtonElement;
  button.click();
  harness.fixture.detectChanges();
}

describe('ModerationComponent', () => {
  it('renders the queue the resolver supplied without fetching it again', () => {
    const correction = newCorrection();

    const harness = createHarness(pageOf([correction]));

    expect(harness.refetches).toBe(0);
    expect(harness.fixture.nativeElement.querySelector('#correction-new-value-0').textContent).toContain(
      correction.newValue,
    );
  });

  it('re-reads the queue after an approval, because the approval removed a row from it', () => {
    const correction = newCorrection();
    const harness = createHarness(pageOf([correction]));

    click(harness, '#btn-approve-0');

    expect(harness.approved).toEqual([correction.id]);
    expect(harness.refetches).toBe(1);
  });

  it('re-reads the queue after a rejection, for the same reason', () => {
    const correction = newCorrection();
    const harness = createHarness(pageOf([correction]));

    click(harness, '#btn-reject-0');

    expect(harness.rejected).toEqual([correction.id]);
    expect(harness.refetches).toBe(1);
  });

  it('reports the failure when the resolver could not load the queue', () => {
    const harness = createHarness(null);

    expect(harness.fixture.nativeElement.textContent).toContain('Failed to load corrections.');
    expect(harness.refetches).toBe(0);
  });
});
