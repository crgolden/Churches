import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ChurchApiService } from '../../shared/church.service';
import { DAYS_OF_WEEK, WORSHIP_STYLES } from '../../shared/models';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent {
  private readonly router = inject(Router);
  private readonly churchService = inject(ChurchApiService);

  protected readonly keyword = signal('');
  protected readonly state = signal('');
  protected readonly worshipStyle = signal<number | null>(null);
  protected readonly denominationId = signal<string | null>(null);
  protected readonly wheelchairAccessible = signal<boolean | null>(null);
  protected readonly dayOfWeek = signal<number | null>(null);
  protected readonly startTimeAfter = signal('');
  protected readonly startTimeBefore = signal('');
  protected readonly lat = signal<number | null>(null);
  protected readonly lng = signal<number | null>(null);
  protected readonly locating = signal(false);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly denominations = toSignal(this.churchService.getDenominations(), { initialValue: [] });

  protected useLocation(): void {
    if (!navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.lat.set(pos.coords.latitude);
        this.lng.set(pos.coords.longitude);
        this.locating.set(false);
      },
      () => this.locating.set(false)
    );
  }

  protected search(): void {
    const params: Record<string, string> = {};
    const kw = this.keyword().trim();
    if (kw) params['q'] = kw;
    const st = this.state().trim();
    if (st) params['state'] = st;
    const ws = this.worshipStyle();
    if (ws != null) params['worshipStyle'] = String(ws);
    const dId = this.denominationId();
    if (dId) params['denominationId'] = dId;
    const wa = this.wheelchairAccessible();
    if (wa != null) params['wheelchairAccessible'] = String(wa);
    const dow = this.dayOfWeek();
    if (dow != null) params['dayOfWeek'] = String(dow);
    const sta = this.startTimeAfter();
    if (sta) params['startTimeAfter'] = sta;
    const stb = this.startTimeBefore();
    if (stb) params['startTimeBefore'] = stb;
    const lat = this.lat();
    const lng = this.lng();
    if (lat != null && lng != null) {
      params['lat'] = String(lat);
      params['lng'] = String(lng);
    }
    void this.router.navigate(['/churches'], { queryParams: params });
  }
}
