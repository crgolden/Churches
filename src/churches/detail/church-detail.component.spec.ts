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

  it('scheduleLabel formats day name and HH:mm time', () => {
    expect(component['scheduleLabel']({ dayOfWeek: 0, startTime: '10:30:00' } as never)).toBe('Sunday 10:30');
    expect(component['scheduleLabel']({ dayOfWeek: 3, startTime: '19:00:00' } as never)).toBe('Wednesday 19:00');
  });

  it('campusAddress joins present address parts', () => {
    expect(component['campusAddress']({ street: '1 N St', city: 'Denver', state: 'CO', zip: '80201' } as never))
      .toBe('1 N St, Denver, CO, 80201');
    expect(component['campusAddress']({ street: null, city: 'Boulder', state: 'CO', zip: '80301' } as never))
      .toBe('Boulder, CO, 80301');
  });

  it('mapPoints includes the church and campuses that have coordinates', () => {
    component['church'].set({
      canonicalName: 'Grace',
      latitude: 1,
      longitude: 2,
      campuses: [{ id: 'c1', name: 'North', latitude: 3, longitude: 4 }],
    } as never);

    const points = component['mapPoints']();

    expect(points.length).toBe(2);
    expect(points[0].label).toBe('Grace');
    expect(points[1].label).toBe('North');
  });

  it('mapPoints skips entries without coordinates', () => {
    component['church'].set({ canonicalName: 'Grace', latitude: 0, longitude: 0, campuses: [] } as never);
    expect(component['mapPoints']().length).toBe(0);
  });

  it('addSchedule POSTs the form to the church schedules endpoint', () => {
    component['church'].set({ id: 'church-1' } as never);
    component['scheduleForm'].setValue({ dayOfWeek: 0, startTime: '10:00', description: 'Worship' });

    component['addSchedule']();

    const req = controller.expectOne('/directory/api/churches/church-1/schedules');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dayOfWeek: 0, startTime: '10:00', description: 'Worship' });
    req.flush({ id: 's1' });
  });

  it('addSchedule does nothing without a start time', () => {
    component['church'].set({ id: 'church-1' } as never);
    component['scheduleForm'].setValue({ dayOfWeek: 0, startTime: '', description: '' });

    component['addSchedule']();

    controller.expectNone('/directory/api/churches/church-1/schedules');
  });

  it('deleteMinistry DELETEs via the API', () => {
    component['church'].set({ id: 'church-1' } as never);

    component['deleteMinistry']('m1');

    const req = controller.expectOne('/directory/api/ministries/m1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('addCampus POSTs the campus form', () => {
    component['church'].set({ id: 'church-1' } as never);
    component['campusForm'].setValue({
      name: 'North', street: '1 N St', city: 'Denver', state: 'CO', zip: '80201', latitude: 39.7, longitude: -104.9,
    });

    component['addCampus']();

    const req = controller.expectOne('/directory/api/churches/church-1/campuses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('North');
    req.flush({ id: 'cp1' });
  });

  it('campusForm starts with empty (null) coordinates so the inputs render blank', () => {
    expect(component['campusForm'].controls.latitude.value).toBeNull();
    expect(component['campusForm'].controls.longitude.value).toBeNull();
  });

  it('addCampus coerces blank coordinates to 0 in the posted body', () => {
    component['church'].set({ id: 'church-1' } as never);
    component['campusForm'].setValue({
      name: 'North', street: '', city: 'Denver', state: 'CO', zip: '80201', latitude: null, longitude: null,
    });

    component['addCampus']();

    const req = controller.expectOne('/directory/api/churches/church-1/campuses');
    expect(req.request.body.latitude).toBe(0);
    expect(req.request.body.longitude).toBe(0);
    req.flush({ id: 'cp1' });
  });
});
