import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ChurchApiService } from '../../shared/church.service';
import { SeoService } from '../../shared/seo.service';
import { DAYS_OF_WEEK, US_STATES, WORSHIP_STYLES } from '../../shared/models';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly churchService = inject(ChurchApiService);
  private readonly seo = inject(SeoService);

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
  protected readonly locationError = signal<string | null>(null);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly usStates = US_STATES;
  protected readonly denominations = toSignal(
    this.churchService.getDenominations().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  ngOnInit(): void {
    this.seo.setPage(
      'Find a Church | Churches',
      'Discover congregations across the United States. Search by location, worship style, denomination, and more.',
      '/',
    );
  }

  // Resolves whatever the user typed/picked (a 2-letter code or a full state name, any case) to the
  // 2-letter code the Directory API expects, or null when it isn't a recognizable state.
  protected resolveStateCode(raw: string): string | null {
    const value = raw.trim();
    if (!value) return null;
    const upper = value.toUpperCase();
    const byCode = US_STATES.find(s => s.code === upper);
    if (byCode) return byCode.code;
    const byName = US_STATES.find(s => s.name.toLowerCase() === value.toLowerCase());
    if (byName) return byName.code;
    return /^[A-Z]{2}$/.test(upper) ? upper : null;
  }

  // Snap the field to the canonical code on commit (blur / datalist pick) so "Texas" becomes "TX".
  protected commitState(raw: string): void {
    this.state.set(this.resolveStateCode(raw) ?? raw.trim());
  }

  protected useLocation(): void {
    this.locationError.set(null);
    if (!navigator.geolocation) {
      this.locationError.set('Location isn’t available in this browser — try searching by city or state.');
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.lat.set(pos.coords.latitude);
        this.lng.set(pos.coords.longitude);
        this.locating.set(false);
      },
      () => {
        this.locating.set(false);
        this.locationError.set('Couldn’t get your location — try searching by city or state.');
      }
    );
  }

  protected search(): void {
    const params: Record<string, string> = {};
    const kw = this.keyword().trim();
    if (kw) params['q'] = kw;
    const st = this.resolveStateCode(this.state());
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
