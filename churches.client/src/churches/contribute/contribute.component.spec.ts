import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContributeComponent } from './contribute.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('ContributeComponent', () => {
  let component: ContributeComponent;
  let fixture: ComponentFixture<ContributeComponent>;
  let controller: HttpTestingController;

  const mockChurch = {
    id: 'c-1',
    slug: 'grace',
    canonicalName: 'Grace Church',
    street: '123 Main',
    city: 'Denver',
    state: 'CO',
    zip: '80201',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContributeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContributeComponent);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submit does nothing when church is null', () => {
    expect(component['church']()).toBeNull();
    component['submit']();
    controller.expectNone(() => true);
  });

  it('submit does nothing when newValue is empty', () => {
    component['church'].set(mockChurch as never);
    component['newValue'].set('');
    component['submit']();
    controller.expectNone(() => true);
  });

  it('submit sets error when value is unchanged', () => {
    component['church'].set(mockChurch as never);
    component['field'].set('canonicalName');
    component['newValue'].set('Grace Church');
    component['submit']();
    expect(component['error']()).toContain('already has that value');
    controller.expectNone(() => true);
  });

  it('submit posts correction and sets submitted on success', () => {
    component['church'].set(mockChurch as never);
    component['field'].set('canonicalName');
    component['newValue'].set('New Grace Church');
    component['submit']();
    const req = controller.expectOne('/directory/api/corrections');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'new-id' });
    expect(component['submitted']()).toBe(true);
    expect(component['submitting']()).toBe(false);
  });

  it('submit sets error message on API failure', () => {
    component['church'].set(mockChurch as never);
    component['field'].set('street');
    component['newValue'].set('456 Oak Ave');
    component['submit']();
    controller.expectOne('/directory/api/corrections').flush('', { status: 500, statusText: 'Error' });
    expect(component['error']()).toContain('Failed to submit');
    expect(component['submitting']()).toBe(false);
  });

  it('submit correctly passes null oldValue for field with null existing value', () => {
    const churchWithNullField = { ...mockChurch, phoneNumber: null };
    component['church'].set(churchWithNullField as never);
    component['field'].set('phoneNumber');
    component['newValue'].set('555-1234');
    component['submit']();
    const req = controller.expectOne('/directory/api/corrections');
    expect(req.request.body).toMatchObject({ oldValue: null, field: 'phoneNumber' });
    req.flush({ id: 'x' });
  });
});
