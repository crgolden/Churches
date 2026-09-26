import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RESPONSE_INIT } from '@angular/core';
import {
  newCount,
  newDisplayName,
  newId,
  newMemberOf,
  newText,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { CHURCH_NOT_FOUND, ChurchDetailComponent } from './church-detail.component';
import { provideRouter } from '@angular/router';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SearchContextService } from '../../shared/search-context.service';
import { SeoService } from '../../shared/seo.service';
import { DirectoryApi } from '../../shared/directory-api';
import { DAYS_OF_WEEK, UNKNOWN_WORSHIP_STYLE_LABEL, US_STATES, WORSHIP_STYLES } from '../../shared/models';
import { HttpMethods } from '../../bff/http-headers';

const CHURCH_ID = crypto.randomUUID();
const MINISTRY_ID = crypto.randomUUID();

function newCoordinate(): number {
  return randomIntBetween(1, 90);
}

function newTimeOfDay(): { hours: number; minutes: number } {
  return { hours: randomIntBetween(10, 24), minutes: randomIntBetween(10, 60) };
}

function newCampusForm() {
  return {
    name: newDisplayName(),
    street: newDisplayName(),
    city: newText(),
    state: newMemberOf(US_STATES).code,
    zip: newText(),
    latitude: newCoordinate(),
    longitude: newCoordinate(),
  };
}

describe('ChurchDetailComponent', () => {
  let component: ChurchDetailComponent;
  let fixture: ComponentFixture<ChurchDetailComponent>;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: RESPONSE_INIT, useValue: {} },
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
    const unmappedStyle = Math.max(...WORSHIP_STYLES.map(style => style.value)) + newCount();

    expect(component.worshipStyleLabel(unmappedStyle)).toBe(UNKNOWN_WORSHIP_STYLE_LABEL);
  });

  it('worshipStyleLabel returns the label of a mapped value', () => {
    const style = newMemberOf(WORSHIP_STYLES);

    const label = component.worshipStyleLabel(style.value);

    expect(label).toBe(style.label);
  });

  it('offers the search results as a link carrying the search the reader came from', () => {
    const searchedTerm = crypto.randomUUID();
    TestBed.inject(SearchContextService).remember({ q: searchedTerm });
    component.error.set(null);
    component.church.set({
      id: crypto.randomUUID(),
      canonicalName: newDisplayName(),
      slug: newText(),
      city: newText(),
      state: newMemberOf(US_STATES).code,
      zip: newText(),
      worshipStyle: newMemberOf(WORSHIP_STYLES).value,
      primaryLanguage: newText(),
      schedules: [],
      ministries: [],
      campuses: [],
    } as never);
    fixture.detectChanges();

    const back = fixture.nativeElement.querySelector('#btn-back') as HTMLElement;
    expect(back).toBeInstanceOf(HTMLAnchorElement);
    expect(back.getAttribute('href')).toContain(`q=${searchedTerm}`);
  });

  it('encodeAddress encodes all present fields', () => {
    const street = newDisplayName();
    const city = newText();
    const state = newMemberOf(US_STATES).code;
    const zip = newText();
    const church = { id: newId(), street, city, state, zip } as never;

    expect(component.encodeAddress(church)).toBe(encodeURIComponent(`${street}, ${city}, ${state}, ${zip}`));
  });

  it('encodeAddress skips null/undefined fields', () => {
    const city = newText();
    const state = newMemberOf(US_STATES).code;
    const church = { id: newId(), city, state } as never;

    expect(component.encodeAddress(church)).toBe(encodeURIComponent(`${city}, ${state}`));
  });

  it('scheduleLabel formats day name and HH:mm time', () => {
    const day = newMemberOf(DAYS_OF_WEEK);
    const { hours, minutes } = newTimeOfDay();
    const seconds = randomIntBetween(10, 60);

    const label = component.scheduleLabel({ dayOfWeek: day.value, startTime: `${hours}:${minutes}:${seconds}` } as never);

    expect(label).toBe(`${day.label} ${hours}:${minutes}`);
  });

  it('campusAddress joins present address parts', () => {
    const street = newDisplayName();
    const city = newText();
    const state = newMemberOf(US_STATES).code;
    const zip = newText();

    expect(component.campusAddress({ street, city, state, zip } as never)).toBe(`${street}, ${city}, ${state}, ${zip}`);
  });

  it('campusAddress leaves out a missing street', () => {
    const city = newText();
    const state = newMemberOf(US_STATES).code;
    const zip = newText();

    expect(component.campusAddress({ street: null, city, state, zip } as never)).toBe(`${city}, ${state}, ${zip}`);
  });

  it('mapPoints includes the church and campuses that have coordinates', () => {
    const churchName = newDisplayName();
    const campusName = newDisplayName();
    component.church.set({
      canonicalName: churchName,
      latitude: newCoordinate(),
      longitude: newCoordinate(),
      campuses: [{ id: newId(), name: campusName, latitude: newCoordinate(), longitude: newCoordinate() }],
    } as never);

    const points = component.mapPoints();

    expect(points.map(point => point.label)).toEqual([churchName, campusName]);
  });

  it('mapPoints skips entries without coordinates', () => {
    component.church.set({
      canonicalName: newDisplayName(),
      latitude: 0,
      longitude: 0,
      campuses: [],
    } as never);
    expect(component.mapPoints().length).toBe(0);
  });

  it('addSchedule POSTs the form to the church schedules endpoint', () => {
    const { hours, minutes } = newTimeOfDay();
    const schedule = {
      dayOfWeek: newMemberOf(DAYS_OF_WEEK).value,
      startTime: `${hours}:${minutes}`,
      description: newDisplayName(),
    };
    component.church.set({ id: CHURCH_ID } as never);
    component.scheduleForm.setValue(schedule);

    component.addSchedule();

    const req = controller.expectOne(DirectoryApi.churchSchedules(CHURCH_ID));
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(schedule);
    req.flush({ id: newId() });
  });

  it('addSchedule does nothing without a start time', () => {
    component.church.set({ id: CHURCH_ID } as never);
    component.scheduleForm.setValue({ dayOfWeek: newMemberOf(DAYS_OF_WEEK).value, startTime: '', description: '' });

    component.addSchedule();

    controller.expectNone(DirectoryApi.churchSchedules(CHURCH_ID));
  });

  it('asking to delete a ministry sends nothing until the delete is confirmed', () => {
    component.church.set({ id: CHURCH_ID } as never);

    component.askToDelete(MINISTRY_ID);

    expect(component.pendingDeleteId()).toBe(MINISTRY_ID);
    controller.expectNone(DirectoryApi.ministry(MINISTRY_ID));
  });

  it('confirming a ministry delete DELETEs via the API', () => {
    component.church.set({ id: CHURCH_ID } as never);
    component.askToDelete(MINISTRY_ID);

    component.confirmDeleteMinistry(MINISTRY_ID);

    const req = controller.expectOne(DirectoryApi.ministry(MINISTRY_ID));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
    expect(component.pendingDeleteId()).toBeNull();
  });

  it('cancelling a delete leaves the row alone', () => {
    component.askToDelete(MINISTRY_ID);

    component.cancelDelete();

    expect(component.pendingDeleteId()).toBeNull();
    controller.expectNone(DirectoryApi.ministry(MINISTRY_ID));
  });

  it('reports a rejected campus save instead of leaving the form silent', () => {
    const rejection = newText();
    component.church.set({ id: CHURCH_ID } as never);
    component.campusForm.setValue({ ...newCampusForm(), state: crypto.randomUUID() });

    component.addCampus();
    controller
      .expectOne(DirectoryApi.churchCampuses(CHURCH_ID))
      .flush(rejection, { status: HttpStatusCode.BadRequest, statusText: newText() });

    expect(component.curationError()).toContain(rejection);
  });

  it('addCampus POSTs the campus form', () => {
    const campus = newCampusForm();
    component.church.set({ id: CHURCH_ID } as never);
    component.campusForm.setValue(campus);

    component.addCampus();

    const req = controller.expectOne(DirectoryApi.churchCampuses(CHURCH_ID));
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body.name).toBe(campus.name);
    req.flush({ id: newId() });
  });

  it('campusForm starts with empty (null) coordinates so the inputs render blank', () => {
    expect(component.campusForm.controls.latitude.value).toBeNull();
    expect(component.campusForm.controls.longitude.value).toBeNull();
  });

  it('addCampus coerces blank coordinates to 0 in the posted body', () => {
    component.church.set({ id: CHURCH_ID } as never);
    component.campusForm.setValue({ ...newCampusForm(), street: '', latitude: null, longitude: null });

    component.addCampus();

    const req = controller.expectOne(DirectoryApi.churchCampuses(CHURCH_ID));
    expect(req.request.body.latitude).toBe(0);
    expect(req.request.body.longitude).toBe(0);
    req.flush({ id: newId() });
  });

  it('loadChurch error sets 404 status and noindex when the church is not found', () => {
    const responseInit = TestBed.inject(RESPONSE_INIT);
    const seo = TestBed.inject(SeoService);
    const spy = vi.spyOn(seo, 'setNoIndex');
    const missingSlug = crypto.randomUUID();
    component.slug = missingSlug;

    component.loadChurch();

    const req = controller.expectOne(DirectoryApi.church(missingSlug));
    req.flush(newText(), { status: HttpStatusCode.NotFound, statusText: newText() });

    expect(component.error()).toBe(CHURCH_NOT_FOUND);
    expect(responseInit?.status).toBe(HttpStatusCode.NotFound);
    expect(spy).toHaveBeenCalled();
  });
});
