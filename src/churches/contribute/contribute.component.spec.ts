import { ComponentFixture, TestBed } from '@angular/core/testing';
import { newDisplayName, newId, newMemberOf, newText } from '@crgolden/modules/testing';
import { ContributeComponent } from './contribute.component';
import { ContributeErrors } from './contribute-errors';
import { CORRECTABLE_FIELDS, CorrectableFieldKeys } from '../../shared/correctable-fields';
import { DirectoryApi } from '../../shared/directory-api';
import { US_STATES, WORSHIP_STYLES } from '../../shared/models';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpMethods } from '../../bff/http-headers';

describe('ContributeComponent', () => {
  let component: ContributeComponent;
  let fixture: ComponentFixture<ContributeComponent>;
  let controller: HttpTestingController;

  const mockChurch = {
    id: newId(),
    slug: newText(),
    canonicalName: newDisplayName(),
    street: newDisplayName(),
    city: newText(),
    state: newMemberOf(US_STATES).code,
    zip: newText(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContributeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { church: mockChurch } } } },
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

  it('takes the church from the resolver rather than fetching it', () => {
    expect(component.church()).toBe(mockChurch as never);
    controller.expectNone(() => true);
  });

  it('starts on the church name, so a reader correcting it chooses nothing first', () => {
    const fieldSelect = fixture.nativeElement.querySelector('#field-select') as HTMLSelectElement;

    expect(fieldSelect.value).toBe(CorrectableFieldKeys.canonicalName);
  });

  it('offers the fields the IRS import gets wrong, not just the text ones', () => {
    const offered = Array.from(
      fixture.nativeElement.querySelectorAll('#field-select option') as NodeListOf<HTMLOptionElement>,
    ).map(option => option.value);

    expect(offered).toContain(CorrectableFieldKeys.worshipStyle);
    expect(offered).toContain(CorrectableFieldKeys.denominationId);
    expect(offered).toContain(CorrectableFieldKeys.wheelchairAccessible);
  });

  it('names each field for a reader rather than showing the property name', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('#field-select option') as NodeListOf<HTMLOptionElement>,
    ).map(option => option.textContent?.trim());

    expect(labels).toEqual(expect.arrayContaining(CORRECTABLE_FIELDS.map(field => field.label)));
    expect(labels).toEqual(expect.not.arrayContaining(CORRECTABLE_FIELDS.map(field => field.key)));
  });

  it('offers worship styles as a list rather than asking for a number', () => {
    component.onFieldChange(CorrectableFieldKeys.worshipStyle);
    fixture.detectChanges();

    const control = fixture.nativeElement.querySelector('#new-value') as HTMLSelectElement;
    expect(control).toBeInstanceOf(HTMLSelectElement);
    expect(Array.from(control.options).map(o => o.textContent?.trim())).toEqual(
      expect.arrayContaining(WORSHIP_STYLES.map(style => style.label)),
    );
  });

  it('shows the style the directory holds, by name', () => {
    const style = newMemberOf(WORSHIP_STYLES);
    component.church.set({ ...mockChurch, worshipStyle: style.value } as never);
    component.onFieldChange(CorrectableFieldKeys.worshipStyle);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#current-value').textContent).toContain(style.label);
  });

  it('clears a value carried over from the previous field', () => {
    component.newValue.set(newText());

    component.onFieldChange(CorrectableFieldKeys.wheelchairAccessible);

    expect(component.newValue()).toBe('');
  });

  it('submit does nothing when there is no church', () => {
    component.church.set(null);
    component.submit();
    controller.expectNone(() => true);
    expect(component.submitted()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('submit does nothing when newValue is empty', () => {
    component.church.set(mockChurch as never);
    component.newValue.set('');
    component.submit();
    controller.expectNone(() => true);
    expect(component.submitted()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('submit sets error when value is unchanged', () => {
    component.church.set(mockChurch as never);
    component.field.set(CorrectableFieldKeys.canonicalName);
    component.newValue.set(mockChurch.canonicalName);
    component.submit();
    expect(component.error()).toBe(ContributeErrors.alreadyHasValue);
    controller.expectNone(() => true);
  });

  it('submit posts correction and sets submitted on success', () => {
    component.church.set(mockChurch as never);
    component.field.set(CorrectableFieldKeys.canonicalName);
    component.newValue.set(newDisplayName());
    component.submit();
    const req = controller.expectOne(DirectoryApi.corrections);
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush({ id: newId() });
    expect(component.submitted()).toBe(true);
    expect(component.submitting()).toBe(false);
  });

  it('submit sets error message on API failure', () => {
    component.church.set(mockChurch as never);
    component.field.set(CorrectableFieldKeys.street);
    component.newValue.set(newDisplayName());
    component.submit();
    controller
      .expectOne(DirectoryApi.corrections)
      .flush('', { status: HttpStatusCode.InternalServerError, statusText: newText() });
    expect(component.error()).toBe(ContributeErrors.submitFailed);
    expect(component.submitting()).toBe(false);
  });

  it('submit correctly passes null oldValue for field with null existing value', () => {
    const churchWithNullField = { ...mockChurch, phoneNumber: null };
    component.church.set(churchWithNullField as never);
    component.field.set(CorrectableFieldKeys.phoneNumber);
    component.newValue.set(newText());
    component.submit();
    const req = controller.expectOne(DirectoryApi.corrections);
    expect(req.request.body).toMatchObject({ oldValue: null, field: CorrectableFieldKeys.phoneNumber });
    req.flush({ id: newId() });
  });
});
