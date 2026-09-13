import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { SeoService } from '../../shared/seo.service';
import { ChurchMapComponent } from '../map/church-map.component';
import { SearchPagedResult, WORSHIP_STYLES } from '../../shared/models';
import { DEFAULT_PAGE_SIZE } from './church-list.resolver';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly results = signal<SearchPagedResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal<string | null>(null);
  protected readonly q = signal<string | null>(null);
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

  protected worshipStyleLabel(value: number): string | undefined {
    return this.worshipStyles.find(s => s.value === value)?.label;
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
      this.pageSize.set(+(params['pageSize'] ?? DEFAULT_PAGE_SIZE));
      this.sort.set(typeof params['sort'] === 'string' ? params['sort'] : null);
      this.q.set(typeof params['q'] === 'string' ? params['q'] : null);
      this.hasGeo.set(params['lat'] != null && params['lng'] != null);
      this.view.set(String(params['view'] ?? 'grid') as ViewMode);
    });
    this.route.data.subscribe(data => {
      const resolved = (data['results'] ?? null) as SearchPagedResult | null;
      this.error.set(resolved === null ? 'Failed to load results. Please try again.' : null);
      this.results.set(resolved);
    });
  }

}
