import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonPrimaryDirective,
  ButtonSecondaryDirective,
  CardDirective,
  PageContainerDirective,
} from '@crgolden/modules/primitives';
import { SeoService } from '../../shared/seo.service';
import { PageTitles, pageTitle } from '../../shared/page-title';
import { CHURCHES_URL, RouteDataKeys } from '../../app/app-paths';
import { DAYS_OF_WEEK, Denomination, US_STATES, WORSHIP_STYLES } from '../../shared/models';
import { SearchParamNames } from '../../shared/directory-api';
import { AriaRoles } from '../../shared/aria-roles';

const LOCATION_TIMEOUT_MS = 10_000;

export const LOCATION_UNAVAILABLE_MESSAGE = 'Location isn’t available in this browser — try searching by city or state.';

export const LOCATION_FAILED_MESSAGE = 'Couldn’t get your location — try searching by city or state.';

@Component({
  selector: 'app-search',
  imports: [DecimalPipe, ButtonPrimaryDirective, ButtonSecondaryDirective, CardDirective, PageContainerDirective],
  templateUrl: './search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit {
  protected readonly ariaRoles = AriaRoles;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  public readonly keyword = signal('');
  public readonly state = signal('');
  public readonly worshipStyle = signal<number | null>(null);
  public readonly denominationId = signal<string | null>(null);
  public readonly wheelchairAccessible = signal<boolean | null>(null);
  public readonly dayOfWeek = signal<number | null>(null);
  public readonly startTimeAfter = signal('');
  public readonly startTimeBefore = signal('');
  public readonly lat = signal<number | null>(null);
  public readonly lng = signal<number | null>(null);
  public readonly locating = signal(false);
  public readonly locationError = signal<string | null>(null);
  public readonly stateError = signal<string | null>(null);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly usStates = US_STATES;
  protected readonly denominations = signal<Denomination[]>(
    (this.route.snapshot.data[RouteDataKeys.denominations] ?? []) as Denomination[],
  );

  public readonly churchCount = signal<number | null>(
    (this.route.snapshot.data[RouteDataKeys.churchCount] ?? null) as number | null,
  );

  protected readonly locationNote = computed(() =>
    this.lat() === null || this.locationError() !== null
      ? null
      : 'Using your location for nearby results',
  );

  ngOnInit(): void {
    this.seo.setPage(
      pageTitle(PageTitles.findAChurch),
      'Discover congregations across the United States. Search by location, worship style, denomination, and more.',
      '/',
    );
  }

  public resolveStateCode(raw: string): string | null {
    const value = raw.trim();
    if (!value) return null;
    const upper = value.toUpperCase();
    const byCode = US_STATES.find(s => s.code === upper);
    if (byCode) return byCode.code;
    const byName = US_STATES.find(s => s.name.toLowerCase() === value.toLowerCase());
    return byName ? byName.code : null;
  }

  public commitState(raw: string): void {
    const resolved = this.resolveStateCode(raw);
    this.state.set(resolved ?? raw.trim());
    this.stateError.set(resolved === null && raw.trim() ? this.unknownStateMessage(raw.trim()) : null);
  }

  public useLocation(): void {
    this.locationError.set(null);
    if (!navigator.geolocation) {
      this.locationError.set(LOCATION_UNAVAILABLE_MESSAGE);
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
        this.locationError.set(LOCATION_FAILED_MESSAGE);
      },
      { timeout: LOCATION_TIMEOUT_MS }
    );
  }

  public search(): void {
    const typedState = this.state().trim();
    const st = this.resolveStateCode(typedState);
    if (typedState && st === null) {
      this.stateError.set(this.unknownStateMessage(typedState));
      return;
    }

    this.stateError.set(null);
    const params: Record<string, string> = {};
    const kw = this.keyword().trim();
    if (kw) params[SearchParamNames.q] = kw;
    if (st) params[SearchParamNames.state] = st;
    const ws = this.worshipStyle();
    if (ws != null) params[SearchParamNames.worshipStyle] = String(ws);
    const dId = this.denominationId();
    if (dId) params[SearchParamNames.denominationId] = dId;
    const wa = this.wheelchairAccessible();
    if (wa != null) params[SearchParamNames.wheelchairAccessible] = String(wa);
    const dow = this.dayOfWeek();
    if (dow != null) params[SearchParamNames.dayOfWeek] = String(dow);
    const sta = this.startTimeAfter();
    if (sta) params[SearchParamNames.startTimeAfter] = sta;
    const stb = this.startTimeBefore();
    if (stb) params[SearchParamNames.startTimeBefore] = stb;
    const lat = this.lat();
    const lng = this.lng();
    if (lat != null && lng != null) {
      params[SearchParamNames.lat] = String(lat);
      params[SearchParamNames.lng] = String(lng);
    }
    void this.router.navigate([CHURCHES_URL], { queryParams: params });
  }

  private unknownStateMessage(typed: string): string {
    return `“${typed}” isn’t a U.S. state — pick one from the list, or leave it blank to search everywhere.`;
  }
}
