import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  ButtonGhostDirective,
  CardDirective,
  PageContainerDirective,
  PageSectionDirective,
} from '@crgolden/modules/primitives';
import { SearchContextService } from '../../shared/search-context.service';
import { SeoService } from '../../shared/seo.service';
import { PageTitles, pageTitle } from '../../shared/page-title';
import { CHURCHES_URL, RouteDataKeys } from '../../app/app-paths';
import { ChurchMapComponent } from '../map/church-map.component';
import { SearchPagedResult, WORSHIP_STYLES } from '../../shared/models';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../../shared/directory-api';
import { AriaRoles } from '../../shared/aria-roles';
import { churchDistanceId, churchNameId, pageNumberId } from './church-list-ids';
import { environment } from '../../environments/environment';

export const ChurchListViews = {
  grid: 'grid',
  list: 'list',
  map: 'map',
} as const;

type ViewMode = (typeof ChurchListViews)[keyof typeof ChurchListViews];

export const CHURCH_LIST_VIEW_PARAMETER = 'view';

export const ChurchListSorts = {
  relevance: 'relevance',
  name: 'name',
  distance: 'distance',
} as const;

export const PAGE_WINDOW = 5;

export function pageLinkLabel(page: number): string {
  return `Page ${page}`;
}

@Component({
  selector: 'app-church-list',
  imports: [
    RouterLink,
    DecimalPipe,
    ChurchMapComponent,
    ButtonGhostDirective,
    CardDirective,
    PageContainerDirective,
    PageSectionDirective,
  ],
  templateUrl: './church-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchListComponent implements OnInit {
  protected readonly ariaRoles = AriaRoles;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchContext = inject(SearchContextService);
  private readonly seo = inject(SeoService);

  public readonly results = signal<SearchPagedResult | null>(null);
  protected readonly error = signal<string | null>(null);
  public readonly page = signal(1);
  public readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal<string | null>(null);
  public readonly q = signal<string | null>(null);
  protected readonly hasGeo = signal(false);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly views = ChurchListViews;
  protected readonly sorts = ChurchListSorts;
  protected readonly pageSizeOptions = environment.pageSizeOptions;
  protected readonly pageLinkLabel = pageLinkLabel;
  protected readonly churchNameId = churchNameId;
  protected readonly churchDistanceId = churchDistanceId;
  protected readonly pageNumberId = pageNumberId;
  public readonly view = signal<ViewMode>(ChurchListViews.grid);

  protected readonly servedPage = computed(() => this.results()?.page ?? this.page());

  protected readonly servedPageSize = computed(() => this.results()?.pageSize ?? this.pageSize());

  protected readonly renderedCount = computed(() => this.results()?.items.length ?? 0);

  public readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.results()?.totalCount ?? 0) / this.servedPageSize())),
  );

  public readonly showingFrom = computed(() =>
    this.renderedCount() === 0 ? 0 : ((this.servedPage() - 1) * this.servedPageSize()) + 1,
  );

  public readonly showingTo = computed(() =>
    this.renderedCount() === 0 ? 0 : this.showingFrom() + this.renderedCount() - 1,
  );

  protected readonly pageIsPastTheEnd = computed(() =>
    (this.results()?.totalCount ?? 0) > 0 && this.renderedCount() === 0,
  );

  public readonly pageWindow = computed(() => {
    const total = this.totalPages();
    const current = Math.min(Math.max(1, this.servedPage()), total);
    let start = Math.max(1, current - Math.floor(PAGE_WINDOW / 2));
    const end = Math.min(total, start + PAGE_WINDOW - 1);
    start = Math.max(1, end - PAGE_WINDOW + 1);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  });

  public worshipStyleLabel(value: number): string | undefined {
    return this.worshipStyles.find(s => s.value === value)?.label;
  }

  public changePageSize(size: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { [SearchParamNames.pageSize]: size, [SearchParamNames.page]: 1 },
    });
  }

  protected viewQuery(view: ViewMode): Record<string, ViewMode> {
    return { [CHURCH_LIST_VIEW_PARAMETER]: view };
  }

  public changeSort(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { [SearchParamNames.sort]: value, [SearchParamNames.page]: 1 },
    });
  }

  ngOnInit(): void {
    this.seo.setPage(
      pageTitle(PageTitles.browseChurches),
      'Search thousands of U.S. churches by location, worship style, denomination, and more.',
      CHURCHES_URL,
    );
    this.route.queryParams.subscribe(params => {
      this.searchContext.remember(params);
      this.page.set(+(params[SearchParamNames.page] ?? 1));
      this.pageSize.set(+(params[SearchParamNames.pageSize] ?? DEFAULT_PAGE_SIZE));
      const sort: unknown = params[SearchParamNames.sort];
      const q: unknown = params[SearchParamNames.q];
      this.sort.set(typeof sort === 'string' ? sort : null);
      this.q.set(typeof q === 'string' ? q : null);
      this.hasGeo.set(params[SearchParamNames.lat] != null && params[SearchParamNames.lng] != null);
      this.view.set(String(params[CHURCH_LIST_VIEW_PARAMETER] ?? ChurchListViews.grid) as ViewMode);
    });
    this.route.data.subscribe(data => {
      const resolved = (data[RouteDataKeys.results] ?? null) as SearchPagedResult | null;
      this.error.set(resolved === null ? 'Failed to load results. Please try again.' : null);
      this.results.set(resolved);
    });
  }

}
