import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchListComponent } from './church-list.component';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

describe('ChurchListComponent', () => {
  let component: ChurchListComponent;
  let fixture: ComponentFixture<ChurchListComponent>;
  let controller: HttpTestingController;

  const emptySearchResult = { items: [], totalCount: 0, page: 1, pageSize: 20 };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
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

  it('toggleView flips showMap signal', () => {
    expect(component['showMap']()).toBe(false);
    component['toggleView']();
    expect(component['showMap']()).toBe(true);
    component['toggleView']();
    expect(component['showMap']()).toBe(false);
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
});
