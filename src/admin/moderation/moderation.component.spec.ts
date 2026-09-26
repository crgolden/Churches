import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { newCount } from '@crgolden/modules/testing';
import { ModerationComponent } from './moderation.component';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../../shared/directory-api';
import { ChurchApiService } from '../../shared/church.service';
import { MERGE_FIELD, PagedResult, UserCorrection } from '../../shared/models';
import { churchUrl } from '../../app/app-paths';
import { LOAD_CORRECTIONS_FAILED } from './moderation.component';

function newCorrection(field: string = crypto.randomUUID()): UserCorrection {
  return {
    id: crypto.randomUUID(),
    churchId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    field,
    oldValue: crypto.randomUUID(),
    newValue: crypto.randomUUID(),
    status: 0,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    churchName: crypto.randomUUID(),
    targetChurchName: crypto.randomUUID(),
    churchSlug: crypto.randomUUID(),
    targetChurchSlug: crypto.randomUUID(),
  };
}

function newMergeCorrection(): UserCorrection {
  return { ...newCorrection(MERGE_FIELD), newValue: crypto.randomUUID() };
}

function pageOf(items: UserCorrection[], totalCount = items.length, page = 1, pageSize = DEFAULT_PAGE_SIZE): PagedResult<UserCorrection> {
  return { items, totalCount, page, pageSize };
}

interface Harness {
  fixture: ComponentFixture<ModerationComponent>;
  refetches: number;
  approved: { id: string; survivingId?: string }[];
  rejected: string[];
}

function createHarness(resolved: PagedResult<UserCorrection> | null, approvalRefusal?: string): Harness {
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
    approveCorrection: (id: string, survivingId?: string): Observable<void> => {
      harness.approved.push({ id, survivingId });
      return approvalRefusal === undefined
        ? of(undefined)
        : throwError(() => new HttpErrorResponse({ status: HttpStatusCode.BadRequest, error: approvalRefusal }));
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
      {
        provide: ActivatedRoute,
        useValue: { data: of({ corrections: resolved }), snapshot: { data: { corrections: resolved } } },
      },
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

    expect(harness.approved).toEqual([{ id: correction.id, survivingId: undefined }]);
    expect(harness.refetches).toBe(1);
  });

  it('names both churches in a merge row rather than showing the target as an id', () => {
    const merge = newMergeCorrection();

    const harness = createHarness(pageOf([merge]));

    const newValueCell = harness.fixture.nativeElement.querySelector('#correction-new-value-0') as HTMLElement;
    expect(newValueCell.textContent).toContain(merge.targetChurchName);
    expect(newValueCell.textContent).not.toContain(merge.newValue);
  });

  it('links the church cell to that church, and falls back to plain text when no slug came back', () => {
    const linkedSlug = crypto.randomUUID();
    const linked = { ...newCorrection(), churchSlug: linkedSlug };
    const absorbed = { ...newCorrection(), churchSlug: null };

    const harness = createHarness(pageOf([linked, absorbed]));

    const link = harness.fixture.nativeElement.querySelector('#correction-church-link-0') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(churchUrl(linkedSlug));
    expect(harness.fixture.nativeElement.querySelector('#correction-church-link-1')).toBeNull();
    const plainCell = harness.fixture.nativeElement.querySelector('#correction-church-1') as HTMLElement;
    expect(plainCell.textContent).toContain(absorbed.churchName);
  });

  it('approves a merge with the church the moderator chose to keep', () => {
    const merge = newMergeCorrection();
    const harness = createHarness(pageOf([merge]));

    click(harness, '#btn-keep-target-0');

    expect(harness.approved).toEqual([{ id: merge.id, survivingId: merge.newValue }]);
  });

  it('approves a merge keeping the suggested church when that button is used', () => {
    const merge = newMergeCorrection();
    const harness = createHarness(pageOf([merge]));

    click(harness, '#btn-keep-church-0');

    expect(harness.approved).toEqual([{ id: merge.id, survivingId: merge.churchId }]);
  });

  it('offers the next page when the queue holds more than one page', () => {
    const firstPage = 1;
    const harness = createHarness(pageOf([newCorrection()], DEFAULT_PAGE_SIZE + newCount(), firstPage, DEFAULT_PAGE_SIZE));

    const next = harness.fixture.nativeElement.querySelector('#btn-next-corrections') as HTMLElement;
    expect(next).toBeInstanceOf(HTMLAnchorElement);
    expect(next.getAttribute('href')).toContain(`${SearchParamNames.page}=${firstPage + 1}`);
    expect(harness.fixture.nativeElement.querySelector('#btn-prev-corrections')).toBeNull();
  });

  it('reports what the API said when an approval is refused', () => {
    const refusal = `choose a survivor ${crypto.randomUUID()}`;
    const merge = newMergeCorrection();
    const harness = createHarness(pageOf([merge]), refusal);

    click(harness, '#btn-keep-target-0');

    expect(harness.fixture.nativeElement.querySelector('#moderation-error').textContent).toContain(refusal);
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

    expect(harness.fixture.nativeElement.textContent).toContain(LOAD_CORRECTIONS_FAILED);
    expect(harness.refetches).toBe(0);
  });
});
