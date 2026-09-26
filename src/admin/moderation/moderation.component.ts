import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ButtonGhostDangerSmallDirective,
  ButtonGhostDirective,
  ButtonPrimarySmallDirective,
  CardDirective,
  PageContainerDirective,
  PageSectionDirective,
} from '@crgolden/modules/primitives';
import { EyebrowDirective } from '../../shared/primitives/primitives';
import { ChurchApiService } from '../../shared/church.service';
import { MERGE_FIELD, PagedResult, UserCorrection } from '../../shared/models';
import { RouteDataKeys } from '../../app/app-paths';
import { AriaRoles } from '../../shared/aria-roles';

export const LOAD_CORRECTIONS_FAILED = 'Failed to load corrections.';

@Component({
  selector: 'app-moderation',
  imports: [
    DatePipe,
    RouterLink,
    ButtonGhostDangerSmallDirective,
    ButtonGhostDirective,
    ButtonPrimarySmallDirective,
    CardDirective,
    EyebrowDirective,
    PageContainerDirective,
    PageSectionDirective,
  ],
  templateUrl: './moderation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationComponent implements OnInit {
  protected readonly ariaRoles = AriaRoles;

  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly corrections = signal<PagedResult<UserCorrection> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly page = signal(1);

  protected readonly totalPages = computed(() => {
    const result = this.corrections();
    return result === null ? 1 : Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  });

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      const resolved = (data[RouteDataKeys.corrections] ?? null) as PagedResult<UserCorrection> | null;
      if (resolved === null) {
        this.error.set(LOAD_CORRECTIONS_FAILED);
        return;
      }
      this.error.set(null);
      this.corrections.set(resolved);
      this.page.set(resolved.page);
    });
  }

  protected isMerge(correction: UserCorrection): boolean {
    return correction.field === MERGE_FIELD;
  }

  private load(page: number): void {
    this.loading.set(true);
    this.api.getCorrections(0, page).subscribe({
      next: result => {
        this.corrections.set(result);
        this.page.set(result.page);
        this.loading.set(false);
      },
      error: () => { this.error.set(LOAD_CORRECTIONS_FAILED); this.loading.set(false); },
    });
  }

  private reloadAfterMutation(): void {
    this.load(this.page());
  }

  protected approve(id: string, survivingId?: string): void {
    this.error.set(null);
    this.notice.set(null);
    this.api.approveCorrection(id, survivingId).subscribe({
      next: () => {
        this.notice.set('Correction approved and applied.');
        this.reloadAfterMutation();
      },
      error: (err: HttpErrorResponse) => this.error.set(
        typeof err.error === 'string' && err.error.trim()
          ? err.error.trim()
          : 'Failed to approve correction.',
      ),
    });
  }

  protected reject(id: string): void {
    this.error.set(null);
    this.notice.set(null);
    this.api.rejectCorrection(id).subscribe({
      next: () => {
        this.notice.set('Correction rejected.');
        this.reloadAfterMutation();
      },
      error: () => this.error.set('Failed to reject correction.'),
    });
  }
}
