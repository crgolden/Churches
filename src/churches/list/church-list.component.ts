import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ChurchApiService } from '../../shared/church.service';
import { SeoService } from '../../shared/seo.service';
import { ChurchMapComponent } from '../map/church-map.component';
import { SearchPagedResult, WORSHIP_STYLES } from '../../shared/models';

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

  protected readonly results = signal<SearchPagedResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly showMap = signal(false);

  protected worshipStyleLabel(value: number): string {
    return this.worshipStyles.find(s => s.value === value)?.label ?? '';
  }

  protected toggleView(): void {
    this.showMap.update(v => !v);
  }

  ngOnInit(): void {
    this.seo.setPage(
      'Browse Churches | Churches',
      'Search thousands of U.S. churches by location, worship style, denomination, and more.',
      '/churches',
    );
    this.route.queryParams.subscribe(params => {
      this.page.set(+(params['page'] ?? 1));
      this.load(params);
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
      page: this.page(),
      pageSize: 20,
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
