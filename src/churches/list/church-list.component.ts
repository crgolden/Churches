import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, ViewportScroller } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ChurchApiService } from '../../shared/church.service';
import { SeoService } from '../../shared/seo.service';
import { ChurchMapComponent } from '../map/church-map.component';
import { SearchPagedResult, WORSHIP_STYLES } from '../../shared/models';

type ViewMode = 'grid' | 'list' | 'map';

const PAGE_WINDOW = 5;

@Component({
  selector: 'app-church-list',
  imports: [RouterLink, DecimalPipe, ChurchMapComponent],
  templateUrl: './church-list.component.html',
  styleUrl: './church-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchListComponent implements OnInit {
  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly viewportScroller = inject(ViewportScroller);

  protected readonly results = signal<SearchPagedResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal('');
  protected readonly q = signal('');
  protected readonly hasGeo = signal(false);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly view = signal<ViewMode>('grid');

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.results()?.totalCount ?? 0) / this.pageSize())),
  );

  protected readonly showingFrom = computed(() => {
    const total = this.results()?.totalCount ?? 0;
    return total === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1;
  });

  protected readonly showingTo = computed(() => {
    const total = this.results()?.totalCount ?? 0;
    return Math.min(total, this.page() * this.pageSize());
  });

  // A window of up to PAGE_WINDOW page numbers centered on the current page, clamped to
  // [1, totalPages], mirroring the numbered-pagination pattern used elsewhere in the workspace.
  protected readonly pageWindow = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    let start = Math.max(1, current - Math.floor(PAGE_WINDOW / 2));
    const end = Math.min(total, start + PAGE_WINDOW - 1);
    start = Math.max(1, end - PAGE_WINDOW + 1);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  });

  protected worshipStyleLabel(value: number): string {
    return this.worshipStyles.find(s => s.value === value)?.label ?? '';
  }

  protected setView(mode: ViewMode): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { view: mode },
    });
  }

  protected changePageSize(size: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { pageSize: size, page: 1 },
    });
  }

  protected changeSort(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { sort: value, page: 1 },
    });
  }

  ngOnInit(): void {
    this.seo.setPage(
      'Browse Churches | Churches',
      'Search thousands of U.S. churches by location, worship style, denomination, and more.',
      '/churches',
    );
    this.route.queryParams.subscribe(params => {
      this.page.set(+(params['page'] ?? 1));
      this.pageSize.set(+(params['pageSize'] ?? 20));
      this.sort.set(String(params['sort'] ?? ''));
      this.q.set(String(params['q'] ?? ''));
      this.hasGeo.set(params['lat'] != null && params['lng'] != null);
      this.view.set((String(params['view'] ?? 'grid') as ViewMode));
      this.load(params);
      this.viewportScroller.scrollToPosition([0, 0]);
    });
  }

  private load(params: Record<string, string>): void {
    this.loading.set(true);
    this.error.set(null);
    const searchParams = {
      q: params['q'],
      state: params['state'],
      lat: params['lat'] ? +params['lat'] : undefined,
      lng: params['lng'] ? +params['lng'] : undefined,
      radiusMiles: params['radiusMiles'] ? +params['radiusMiles'] : undefined,
      denominationId: params['denominationId'] || undefined,
      worshipStyle: params['worshipStyle'] ? +params['worshipStyle'] : undefined,
      wheelchairAccessible: params['wheelchairAccessible'] != null
        ? params['wheelchairAccessible'] === 'true'
        : undefined,
      dayOfWeek: params['dayOfWeek'] ? +params['dayOfWeek'] : undefined,
      startTimeAfter: params['startTimeAfter'] || undefined,
      startTimeBefore: params['startTimeBefore'] || undefined,
      sort: this.sort() || undefined,
      page: this.page(),
      pageSize: this.pageSize(),
    };
    this.api.search(searchParams).subscribe({
      next: result => {
        this.results.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load results. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected goToPage(p: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { page: p },
    });
  }
}
