import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchDetailComponent } from './church-detail.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';

describe('ChurchDetailComponent', () => {
  let component: ChurchDetailComponent;
  let fixture: ComponentFixture<ChurchDetailComponent>;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchDetailComponent);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('worshipStyleLabel returns Unknown for unmapped value', () => {
    expect(component['worshipStyleLabel'](999)).toBe('Unknown');
  });

  it('worshipStyleLabel returns label string for a valid value', () => {
    const label = component['worshipStyleLabel'](1);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('back delegates to Location', () => {
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    component['back']();
    expect(spy).toHaveBeenCalled();
  });

  it('encodeAddress encodes all present fields', () => {
    const church = { id: '1', street: '123 Main St', city: 'Denver', state: 'CO', zip: '80201' } as never;
    expect(component['encodeAddress'](church)).toBe(encodeURIComponent('123 Main St, Denver, CO, 80201'));
  });

  it('encodeAddress skips null/undefined fields', () => {
    const church = { id: '1', city: 'Boulder', state: 'CO' } as never;
    expect(component['encodeAddress'](church)).toBe(encodeURIComponent('Boulder, CO'));
  });
});
