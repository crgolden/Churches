import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import {
  CHURCH_LIST_VIEW_PARAMETER,
  ChurchListComponent,
  ChurchListSorts,
  ChurchListViews,
  PAGE_WINDOW,
  pageLinkLabel,
} from './church-list.component';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import {
  newCount,
  newCountCeiling,
  newDisplayName,
  newMemberOf,
  newMemberOtherThan,
  newText,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { SearchPagedResult, US_STATES, WORSHIP_STYLES } from '../../shared/models';
import { DEFAULT_PAGE_SIZE, SearchParamNames } from '../../shared/directory-api';
import { environment } from '../../environments/environment';
import { By } from '@angular/platform-browser';
import { ChurchMapComponent } from '../map/church-map.component';
import { CHURCH_DISTANCE_ID_PREFIX, PAGE_NUMBER_ID_PREFIX, churchDistanceId, churchNameId } from './church-list-ids';

describe('ChurchListComponent', () => {
  let component: ChurchListComponent;
  let fixture: ComponentFixture<ChurchListComponent>;
  let controller: HttpTestingController;
  let scrollSpy: ReturnType<typeof vi.fn>;
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let routeData$: BehaviorSubject<Record<string, unknown>>;

  const emptySearchResult = { items: [], totalCount: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE };

  function pageOfItems(count: number): SearchPagedResult['items'] {
    return Array.from({ length: count }, () => ({
      church: {
        id: crypto.randomUUID(),
        canonicalName: newDisplayName(),
        slug: newText(),
        city: newText(),
        state: newMemberOf(US_STATES).code,
        zip: newText(),
        worshipStyle: newMemberOf(WORSHIP_STYLES).value,
        wheelchairAccessible: null,
        website: null,
      },
      distanceMiles: null,
    })) as unknown as SearchPagedResult['items'];
  }

  function servedPage(items: number, totalCount: number, page: number, pageSize: number): SearchPagedResult {
    return { items: pageOfItems(items), totalCount, page, pageSize };
  }

  function newPageSize(): number {
    return newMemberOf(environment.pageSizeOptions);
  }

  function pageNumberLinks(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`[id^="${PAGE_NUMBER_ID_PREFIX}"]`));
  }

  function numberFormat(): Intl.NumberFormat {
    return new Intl.NumberFormat(TestBed.inject(LOCALE_ID));
  }

  beforeEach(async () => {
    scrollSpy = vi.fn();

    queryParams$ = new BehaviorSubject<Record<string, string>>({});
    routeData$ = new BehaviorSubject<Record<string, unknown>>({ results: emptySearchResult });

    await TestBed.configureTestingModule({
      imports: [ChurchListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ViewportScroller, useValue: { scrollToPosition: scrollSpy } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$,
            data: routeData$,
            snapshot: { queryParams: {}, data: { results: emptySearchResult } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchListComponent);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('worshipStyleLabel returns label for a known worship style value', () => {
    const style = newMemberOf(WORSHIP_STYLES);

    expect(component.worshipStyleLabel(style.value)).toBe(style.label);
  });

  it('worshipStyleLabel returns undefined for unknown value', () => {
    const unmappedStyle = Math.max(...WORSHIP_STYLES.map(style => style.value)) + newCount();

    expect(component.worshipStyleLabel(unmappedStyle)).toBeUndefined();
  });

  it('renders each view toggle as an anchor carrying its own href', () => {
    component.results.set({ ...emptySearchResult, totalCount: 1 });
    fixture.detectChanges();

    const mapToggle = fixture.nativeElement.querySelector('#btn-view-map') as HTMLElement;
    expect(mapToggle).toBeInstanceOf(HTMLAnchorElement);
    expect(mapToggle.getAttribute('href')).toContain(`${CHURCH_LIST_VIEW_PARAMETER}=${ChurchListViews.map}`);
  });

  it('defaults to grid view', () => {
    expect(component.view()).toBe(ChurchListViews.grid);
  });

  it('renders every pagination control as an anchor carrying its own href', () => {
    const pageSize = newPageSize();
    const pageCount = randomIntBetween(3, PAGE_WINDOW + 1);
    const servedPageNumber = randomIntBetween(2, pageCount);
    component.results.set(servedPage(pageSize, pageSize * pageCount, servedPageNumber, pageSize));
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector('#btn-next-page') as HTMLElement;
    expect(next).toBeInstanceOf(HTMLAnchorElement);
    expect(next.getAttribute('href')).toContain(`${SearchParamNames.page}=${servedPageNumber + 1}`);

    const previous = fixture.nativeElement.querySelector('#btn-prev-page') as HTMLElement;
    expect(previous).toBeInstanceOf(HTMLAnchorElement);
    expect(previous.getAttribute('href')).toContain(`${SearchParamNames.page}=${servedPageNumber - 1}`);

    const numbered = pageNumberLinks();
    expect(numbered).toHaveLength(pageCount);
    numbered.forEach((link, index) => {
      expect(link).toBeInstanceOf(HTMLAnchorElement);
      expect(link.getAttribute('href')).toContain(`${SearchParamNames.page}=${index + 1}`);
    });
  });

  it('renders no Previous control on the first page, where there is no page to go back to', () => {
    const pageSize = newPageSize();
    component.results.set(servedPage(pageSize, pageSize * randomIntBetween(2, PAGE_WINDOW), 1, pageSize));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#btn-prev-page')).toBeNull();
    expect(fixture.nativeElement.querySelector('#btn-next-page')).not.toBeNull();
  });

  it('renders no Next control on the last page, where there is no page to go on to', () => {
    const pageSize = newPageSize();
    const pageCount = randomIntBetween(2, PAGE_WINDOW);
    component.results.set(servedPage(pageSize, pageSize * pageCount, pageCount, pageSize));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#btn-next-page')).toBeNull();
    expect(fixture.nativeElement.querySelector('#btn-prev-page')).not.toBeNull();
  });

  it('names each page-number link as a page, so a screen reader does not read a bare number', () => {
    const pageSize = newPageSize();
    const pageCount = randomIntBetween(2, PAGE_WINDOW + 1);
    component.results.set(servedPage(pageSize, pageSize * pageCount, 1, pageSize));
    fixture.detectChanges();

    expect(pageNumberLinks().map(link => link.getAttribute('aria-label'))).toEqual(
      Array.from({ length: pageCount }, (_, index) => pageLinkLabel(index + 1)),
    );
  });

  it('changePageSize navigates with updated pageSize and resets page to 1', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const chosenPageSize = newPageSize();

    component.changePageSize(chosenPageSize);

    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { [SearchParamNames.pageSize]: chosenPageSize, [SearchParamNames.page]: 1 } }),
    );
  });

  it('changeSort navigates with updated sort and resets page to 1', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const chosenSort = newMemberOf(Object.values(ChurchListSorts));

    component.changeSort(chosenSort);

    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { [SearchParamNames.sort]: chosenSort, [SearchParamNames.page]: 1 } }),
    );
  });

  it('leaves scrolling to the router, so a back navigation can restore the reader position', () => {
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  describe('paging computeds', () => {
    const pageSize = newMemberOf(environment.pageSizeOptions);
    const pageCount = randomIntBetween(3, PAGE_WINDOW * 2);
    const totalCount = pageSize * (pageCount - 1) + randomIntBetween(1, pageSize);
    const servedPageNumber = randomIntBetween(2, pageCount);

    beforeEach(() => {
      component.results.set(servedPage(pageSize, totalCount, servedPageNumber, pageSize));
      fixture.detectChanges();
    });

    it('computes totalPages from totalCount and the served page size', () => {
      expect(component.totalPages()).toBe(pageCount);
    });

    it('computes showingFrom for the served page', () => {
      expect(component.showingFrom()).toBe((servedPageNumber - 1) * pageSize + 1);
    });

    it('computes showingTo from the rows the response actually carried', () => {
      expect(component.showingTo()).toBe(servedPageNumber * pageSize);
    });
  });

  describe('a page number the URL asked for that the response did not serve', () => {
    it('reports the range the response carried, not the one the URL implies', () => {
      const servedPageSize = newPageSize();
      const totalCount = newCount();
      const pastTheEndPage = Math.ceil(totalCount / servedPageSize) + newCount();
      component.page.set(pastTheEndPage);
      component.pageSize.set(newCountCeiling());
      component.results.set({ items: [], totalCount, page: pastTheEndPage, pageSize: servedPageSize });
      fixture.detectChanges();

      expect(component.showingFrom()).toBe(0);
      expect(component.showingTo()).toBe(0);
      expect(fixture.nativeElement.querySelector('#showing-indicator').textContent).toContain(numberFormat().format(totalCount));
      expect(fixture.nativeElement.querySelector('#page-past-the-end')).not.toBeNull();
    });

    it('keeps the last page in range when the URL asks past the end', () => {
      const servedPageSize = newPageSize();
      const pageCount = PAGE_WINDOW + randomIntBetween(0, PAGE_WINDOW);
      const pastTheEndPage = pageCount + newCount();
      component.page.set(pastTheEndPage);
      component.results.set({ items: [], totalCount: servedPageSize * pageCount, page: pastTheEndPage, pageSize: servedPageSize });
      fixture.detectChanges();

      expect(component.pageWindow()).toEqual(
        Array.from({ length: PAGE_WINDOW }, (_, index) => pageCount - PAGE_WINDOW + 1 + index),
      );
    });

    it('marks the page size the response served, not the one the URL asked for', () => {
      const servedPageSize = newPageSize();
      component.pageSize.set(newMemberOtherThan(environment.pageSizeOptions, servedPageSize));
      component.results.set(servedPage(servedPageSize, servedPageSize * randomIntBetween(2, PAGE_WINDOW), 1, servedPageSize));
      fixture.detectChanges();

      const selected: HTMLOptionElement = fixture.nativeElement.querySelector(`#page-size-select option[value="${servedPageSize}"]`);
      expect(selected.selected).toBe(true);
    });
  });

  it('groups the digits of the showing range the same way the result count does', () => {
    const pageSize = newPageSize();
    const page = newCountCeiling();
    const totalCount = (page + 1) * pageSize + randomIntBetween(0, pageSize);
    const grouped = numberFormat();
    component.results.set(servedPage(pageSize, totalCount, page, pageSize));
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('#showing-indicator') as HTMLElement;
    const resultCount = fixture.nativeElement.querySelector('#result-count') as HTMLElement;
    expect(indicator.textContent).toContain(grouped.format((page - 1) * pageSize + 1));
    expect(indicator.textContent).toContain(grouped.format(page * pageSize));
    expect(indicator.textContent).toContain(grouped.format(totalCount));
    expect(resultCount.textContent).toContain(grouped.format(totalCount));
  });

  describe('searched term display', () => {
    it('renders the searched term when q is set', () => {
      const searchedTerm = newDisplayName();
      component.q.set(searchedTerm);
      component.results.set({ items: [], totalCount: 1, page: 1, pageSize: DEFAULT_PAGE_SIZE });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(searchedTerm);
    });
  });

  describe('view rendering', () => {
    beforeEach(() => {
      component.results.set(servedPage(1, 1, 1, DEFAULT_PAGE_SIZE));
    });

    it('renders grid cards when view is grid', () => {
      component.view.set(ChurchListViews.grid);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#church-grid')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('#church-list')).toBeFalsy();
    });

    it('renders compact rows when view is list', () => {
      component.view.set(ChurchListViews.list);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#church-list')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('#church-grid')).toBeFalsy();
    });

    it('renders the map component when view is map', () => {
      component.view.set(ChurchListViews.map);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.directive(ChurchMapComponent))).toBeTruthy();
    });

    it.each([ChurchListViews.grid, ChurchListViews.list])('shows the distance on a %s row the search measured', view => {
      const measured = servedPage(1, 1, 1, DEFAULT_PAGE_SIZE);
      measured.items[0].distanceMiles = newCount();
      component.results.set(measured);
      component.view.set(view);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector(`#${churchDistanceId(0)}`)).not.toBeNull();
    });

    it.each([ChurchListViews.grid, ChurchListViews.list])('omits the distance on a %s row the search did not measure', view => {
      component.view.set(view);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector(`#${churchNameId(0)}`)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(`[id^="${CHURCH_DISTANCE_ID_PREFIX}"]`)).toBeNull();
    });

    it('keeps the pager in map view, so the map is not stuck on the first page', () => {
      const pageSize = newPageSize();
      component.results.set(servedPage(pageSize, pageSize * randomIntBetween(2, PAGE_WINDOW), 1, pageSize));
      component.view.set(ChurchListViews.map);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(ChurchMapComponent))).toBeTruthy();
      expect(fixture.nativeElement.querySelector('#btn-next-page')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('#showing-indicator')).not.toBeNull();
    });
  });
});
