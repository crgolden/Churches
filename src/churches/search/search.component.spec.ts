import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import {
  digitToken,
  newCountCeiling,
  newMemberOf,
  newText,
  newTokenOtherThan,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { LOCATION_FAILED_MESSAGE, LOCATION_UNAVAILABLE_MESSAGE, SearchComponent } from './search.component';
import { CHURCHES_URL } from '../../app/app-paths';
import { DAYS_OF_WEEK, US_STATES, WORSHIP_STYLES } from '../../shared/models';
import { SearchParamNames } from '../../shared/directory-api';

function pickState(): { code: string; name: string } {
  return newMemberOf(US_STATES);
}

function newLatitude(): number {
  return randomIntBetween(-89, 90);
}

function newLongitude(): number {
  return randomIntBetween(-179, 180);
}

function newUnrecognizedStateText(): string {
  return newTokenOtherThan(...US_STATES.flatMap(state => [state.code.toLowerCase(), state.name.toLowerCase()]));
}
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchApiService } from '../../shared/church.service';
import { of } from 'rxjs';
import { AriaRoles } from '../../shared/aria-roles';

describe('SearchComponent', () => {
  let component: SearchComponent;
  let fixture: ComponentFixture<SearchComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchComponent],
      providers: [provideRouter([]), provideHttpClient(withXhr()), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(ChurchApiService).getDenominations = () => of([]);
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(SearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates to /churches with no params when all fields empty', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], { queryParams: {} });
  });

  it('includes q param when keyword is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const keyword = crypto.randomUUID();
    component.keyword.set(keyword);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ q: keyword }),
    });
  });

  it('includes state param when state is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const state = pickState();
    component.state.set(state.code);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ state: state.code }),
    });
  });

  it('refuses to search on a value that is not a U.S. state, rather than searching for nothing', () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const typed = `not-a-state-${crypto.randomUUID()}`;
    component.state.set(typed);

    component.search();

    expect(spy).not.toHaveBeenCalled();
    expect(component.stateError()).toContain(typed);
  });

  it('primes the unknown-state live region before the error, so a screen reader announces it', () => {
    const beforeTheError = fixture.nativeElement.querySelector(
      '#search-state-error-announcement',
    ) as HTMLElement;
    expect(beforeTheError.getAttribute('role')).toBe(AriaRoles.status);
    expect(beforeTheError.hidden).toBe(false);
    expect(beforeTheError.textContent?.trim()).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('#search-state-error')).toBeNull();

    const typed = `not-a-state-${crypto.randomUUID()}`;
    component.state.set(typed);
    component.search();
    fixture.detectChanges();

    const afterTheError = fixture.nativeElement.querySelector(
      '#search-state-error-announcement',
    ) as HTMLElement;
    expect(afterTheError).toBe(beforeTheError);
    expect(afterTheError.hidden).toBe(false);
    expect(afterTheError.textContent).toContain(typed);
    expect(fixture.nativeElement.querySelector('#search-state-error').textContent).toContain(typed);
  });

  it('accepts a state name and searches on its code', () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const state = pickState();
    component.commitState(state.name);

    component.search();

    expect(component.stateError()).toBeNull();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ state: state.code }),
    });
  });

  it('renders the church count the route resolved rather than a hardcoded figure', () => {
    const resolvedCount = newCountCeiling();
    component.churchCount.set(resolvedCount);
    fixture.detectChanges();

    const rendered = fixture.nativeElement.querySelector('#church-count') as HTMLElement;
    expect(rendered.textContent.trim()).toBe(new Intl.NumberFormat(TestBed.inject(LOCALE_ID)).format(resolvedCount));
  });

  it('renders no count at all when the count could not be resolved', () => {
    component.churchCount.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#church-count')).toBeNull();
  });

  it('includes worshipStyle param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const worshipStyle = newMemberOf(WORSHIP_STYLES).value;
    component.worshipStyle.set(worshipStyle);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ worshipStyle: String(worshipStyle) }),
    });
  });

  it('includes denominationId param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const id = crypto.randomUUID();
    component.denominationId.set(id);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ denominationId: id }),
    });
  });

  it('includes wheelchairAccessible param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.wheelchairAccessible.set(true);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ wheelchairAccessible: String(true) }),
    });
  });

  it('includes dayOfWeek param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const dayOfWeek = newMemberOf(DAYS_OF_WEEK).value;
    component.dayOfWeek.set(dayOfWeek);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ [SearchParamNames.dayOfWeek]: String(dayOfWeek) }),
    });
  });

  it('includes startTimeAfter and startTimeBefore params when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const startTimeAfter = crypto.randomUUID();
    const startTimeBefore = crypto.randomUUID();
    component.startTimeAfter.set(startTimeAfter);
    component.startTimeBefore.set(startTimeBefore);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ startTimeAfter, startTimeBefore }),
    });
  });

  it('includes lat/lng params when location is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const latitude = newLatitude();
    const longitude = newLongitude();
    component.lat.set(latitude);
    component.lng.set(longitude);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ [SearchParamNames.lat]: String(latitude), [SearchParamNames.lng]: String(longitude) }),
    });
  });

  it('does not include lat/lng when only lat is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.lat.set(newLatitude());
    component.search();
    const [, opts] = spy.mock.calls[0];
    expect((opts as { queryParams: Record<string, string> }).queryParams[SearchParamNames.lat]).toBeUndefined();
  });

  it('useLocation does nothing when geolocation is unavailable', () => {
    const origGeo = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', { value: null, configurable: true });
    component.useLocation();
    expect(component.locating()).toBe(false);
    Object.defineProperty(navigator, 'geolocation', { value: origGeo, configurable: true });
  });

  it('useLocation sets locating while waiting', () => {
    const geoMock = { getCurrentPosition: vi.fn() };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component.useLocation();
    expect(component.locating()).toBe(true);
  });

  it('useLocation sets lat/lng on success', () => {
    const latitude = newLatitude();
    const longitude = newLongitude();
    const geoMock = {
      getCurrentPosition: vi.fn((success: (p: GeolocationPosition) => void) => {
        success({ coords: { latitude, longitude } } as GeolocationPosition);
      }),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component.useLocation();
    expect(component.lat()).toBe(latitude);
    expect(component.lng()).toBe(longitude);
    expect(component.locating()).toBe(false);
  });

  it('useLocation clears locating on error', () => {
    const geoMock = {
      getCurrentPosition: vi.fn((_: unknown, error: () => void) => error()),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component.useLocation();
    expect(component.locating()).toBe(false);
  });

  it('useLocation sets a locationError message on error', () => {
    const geoMock = {
      getCurrentPosition: vi.fn((_: unknown, error: () => void) => error()),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component.useLocation();
    expect(component.locationError()).toBe(LOCATION_FAILED_MESSAGE);
  });

  it('useLocation sets a locationError message when geolocation is unavailable', () => {
    const origGeo = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', { value: null, configurable: true });
    component.useLocation();
    expect(component.locationError()).toBe(LOCATION_UNAVAILABLE_MESSAGE);
    Object.defineProperty(navigator, 'geolocation', { value: origGeo, configurable: true });
  });

  it('useLocation clears a prior locationError on success', () => {
    component.locationError.set(newText());
    const geoMock = {
      getCurrentPosition: vi.fn((success: (p: GeolocationPosition) => void) => {
        success({ coords: { latitude: newLatitude(), longitude: newLongitude() } } as GeolocationPosition);
      }),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component.useLocation();
    expect(component.locationError()).toBeNull();
  });

  it('resolveStateCode passes a valid 2-letter code through (any case)', () => {
    const state = pickState();
    expect(component.resolveStateCode(state.code.toLowerCase())).toBe(state.code);
    expect(component.resolveStateCode(state.code)).toBe(state.code);
  });

  it('resolveStateCode resolves a full state name to its code (any case)', () => {
    const state = pickState();
    expect(component.resolveStateCode(state.name)).toBe(state.code);
    expect(component.resolveStateCode(`  ${state.name.toLowerCase()} `)).toBe(state.code);
    expect(component.resolveStateCode(state.name.toUpperCase())).toBe(state.code);
  });

  it('resolveStateCode returns null for empty or unrecognizable input', () => {
    expect(component.resolveStateCode('')).toBeNull();
    expect(component.resolveStateCode('   ')).toBeNull();
    expect(component.resolveStateCode(newUnrecognizedStateText())).toBeNull();
    expect(component.resolveStateCode(digitToken(randomIntBetween(2, 6)))).toBeNull();
  });

  it('commitState snaps a typed state name to its 2-letter code', () => {
    const state = pickState();
    component.commitState(state.name);
    expect(component.state()).toBe(state.code);
  });

  it('commitState leaves unrecognized input as trimmed text', () => {
    const unrecognized = newUnrecognizedStateText();
    component.commitState(`  ${unrecognized} `);
    expect(component.state()).toBe(unrecognized);
  });

  it('search resolves a typed state name to its code in the query params', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const state = pickState();
    component.state.set(state.name);
    component.search();
    expect(spy).toHaveBeenCalledWith([CHURCHES_URL], {
      queryParams: expect.objectContaining({ state: state.code }),
    });
  });

  it('renders the locationError message in the DOM when geolocation fails', () => {
    const geoMock = {
      getCurrentPosition: vi.fn((_: unknown, error: () => void) => error()),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component.useLocation();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const note = el.querySelector('#location-error');
    expect(note?.textContent?.trim()).toBe(LOCATION_FAILED_MESSAGE);
  });
});
