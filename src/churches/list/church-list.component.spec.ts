import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchListComponent } from './church-list.component';
import { provideRouter, Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

describe('ChurchListComponent', () => {
  let component: ChurchListComponent;
  let fixture: ComponentFixture<ChurchListComponent>;
  let controller: HttpTestingController;
  let scrollSpy: ReturnType<typeof vi.fn>;

  const emptySearchResult = { items: [], totalCount: 0, page: 1, pageSize: 20 };

  beforeEach(async () => {
    scrollSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ChurchListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ViewportScroller, useValue: { scrollToPosition: scrollSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchListComponent);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // ngOnInit fires a search request when subscribing to empty queryParams
    controller.expectOne(r => r.url.includes('/search')).flush(emptySearchResult);
  });

  afterEach(() => controller.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('worshipStyleLabel returns label for a known worship style value', () => {
    expect(component['worshipStyleLabel'](1)).toBe('Traditional');
  });

  it('worshipStyleLabel returns empty string for unknown value', () => {
    expect(component['worshipStyleLabel'](999)).toBe('');
  });

  it('setView updates the view query param', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['setView']('list');
    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { view: 'list' } })
    );
  });

  it('defaults to grid view', () => {
    expect(component['view']()).toBe('grid');
  });

  it('goToPage navigates with updated page queryParam', async () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['goToPage'](3);
    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: 3 } })
    );
  });

  it('changePageSize navigates with updated pageSize and resets page to 1', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['changePageSize'](50);
    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { pageSize: 50, page: 1 } })
    );
  });

  it('changeSort navigates with updated sort and resets page to 1', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['changeSort']('name');
    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { sort: 'name', page: 1 } })
    );
  });

  it('scrolls to top after a query-params-driven load', () => {
    // The initial ngOnInit subscription (flushed in beforeEach) already triggers one scroll call.
    expect(scrollSpy).toHaveBeenCalledWith([0, 0]);
  });

  describe('paging computeds', () => {
    beforeEach(() => {
      component['results'].set({ items: [], totalCount: 95, page: 1, pageSize: 20 });
      component['pageSize'].set(20);
      component['page'].set(2);
      fixture.detectChanges();
    });

    it('computes totalPages from totalCount and pageSize', () => {
      expect(component['totalPages']()).toBe(5);
    });

    it('computes showingFrom for the current page', () => {
      expect(component['showingFrom']()).toBe(21);
    });

    it('computes showingTo for the current page', () => {
      expect(component['showingTo']()).toBe(40);
    });
  });

  describe('searched term display', () => {
    it('renders "for \\"term\\"" when q is set', () => {
      component['q'].set('Grace Chapel');
      component['results'].set({ items: [], totalCount: 1, page: 1, pageSize: 20 });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Grace Chapel');
    });
  });

  describe('view rendering', () => {
    const churchItem = {
      church: {
        id: '1',
        canonicalName: 'Grace Chapel',
        slug: 'grace-chapel',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        worshipStyle: 0,
        wheelchairAccessible: false,
        website: null,
      },
      distanceMiles: null,
    };

    beforeEach(() => {
      component['results'].set({ items: [churchItem] as never, totalCount: 1, page: 1, pageSize: 20 });
    });

    it('renders grid cards when view is grid', () => {
      component['view'].set('grid');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.church-grid')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.church-list')).toBeFalsy();
    });

    it('renders compact rows when view is list', () => {
      component['view'].set('list');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.church-list')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.church-grid')).toBeFalsy();
    });

    it('renders the map component when view is map', () => {
      component['view'].set('map');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-church-map')).toBeTruthy();
    });
  });
});
