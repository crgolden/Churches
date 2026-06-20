import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchComponent } from './search.component';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchApiService } from '../../shared/church.service';
import { of } from 'rxjs';

describe('SearchComponent', () => {
  let component: SearchComponent;
  let fixture: ComponentFixture<SearchComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    // Stub getDenominations so it doesn't hit the network
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
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], { queryParams: {} });
  });

  it('includes q param when keyword is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['keyword'].set('grace');
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ q: 'grace' }),
    });
  });

  it('includes state param when state is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['state'].set('AZ');
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ state: 'AZ' }),
    });
  });

  it('includes worshipStyle param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['worshipStyle'].set(2);
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ worshipStyle: '2' }),
    });
  });

  it('includes denominationId param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const id = crypto.randomUUID();
    component['denominationId'].set(id);
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ denominationId: id }),
    });
  });

  it('includes wheelchairAccessible param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['wheelchairAccessible'].set(true);
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ wheelchairAccessible: 'true' }),
    });
  });

  it('includes dayOfWeek param when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['dayOfWeek'].set(0);
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ dayOfWeek: '0' }),
    });
  });

  it('includes startTimeAfter and startTimeBefore params when set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['startTimeAfter'].set('09:00');
    component['startTimeBefore'].set('12:00');
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ startTimeAfter: '09:00', startTimeBefore: '12:00' }),
    });
  });

  it('includes lat/lng params when location is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['lat'].set(39.7);
    component['lng'].set(-104.9);
    component['search']();
    expect(spy).toHaveBeenCalledWith(['/churches'], {
      queryParams: expect.objectContaining({ lat: '39.7', lng: '-104.9' }),
    });
  });

  it('does not include lat/lng when only lat is set', async () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['lat'].set(39.7);
    component['search']();
    const [, opts] = spy.mock.calls[0];
    expect((opts as { queryParams: Record<string, string> }).queryParams['lat']).toBeUndefined();
  });

  it('useLocation does nothing when geolocation is unavailable', () => {
    const origGeo = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', { value: null, configurable: true });
    component['useLocation']();
    expect(component['locating']()).toBe(false);
    Object.defineProperty(navigator, 'geolocation', { value: origGeo, configurable: true });
  });

  it('useLocation sets locating while waiting', () => {
    const geoMock = { getCurrentPosition: vi.fn() };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component['useLocation']();
    expect(component['locating']()).toBe(true);
  });

  it('useLocation sets lat/lng on success', () => {
    const geoMock = {
      getCurrentPosition: vi.fn((success: (p: GeolocationPosition) => void) => {
        success({ coords: { latitude: 39.7, longitude: -104.9 } } as GeolocationPosition);
      }),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component['useLocation']();
    expect(component['lat']()).toBe(39.7);
    expect(component['lng']()).toBe(-104.9);
    expect(component['locating']()).toBe(false);
  });

  it('useLocation clears locating on error', () => {
    const geoMock = {
      getCurrentPosition: vi.fn((_: unknown, error: () => void) => error()),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geoMock, configurable: true });
    component['useLocation']();
    expect(component['locating']()).toBe(false);
  });
});
