import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchApiService } from './church.service';

describe('ChurchApiService', () => {
  let service: ChurchApiService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChurchApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ChurchApiService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('getDenominations hits /directory/api/denominations', () => {
    service.getDenominations().subscribe();
    controller.expectOne('/directory/api/denominations').flush([]);
  });

  it('getChurches hits /directory/api/churches with page params', () => {
    service.getChurches(2, 10).subscribe();
    const req = controller.expectOne(r => r.url.includes('/churches'));
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 10 });
  });

  it('getChurchBySlug hits /directory/api/churches/{slug}', () => {
    service.getChurchBySlug('grace-church').subscribe();
    controller.expectOne('/directory/api/churches/grace-church').flush({});
  });

  it('search with no optional params sends only page and pageSize', () => {
    service.search({ page: 1, pageSize: 20 }).subscribe();
    const req = controller.expectOne(r => r.url.includes('/search'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('lat')).toBe(false);
    expect(req.request.params.has('lng')).toBe(false);
    expect(req.request.params.has('radiusMiles')).toBe(false);
    expect(req.request.params.has('state')).toBe(false);
    expect(req.request.params.has('denominationId')).toBe(false);
    expect(req.request.params.has('worshipStyle')).toBe(false);
    expect(req.request.params.has('wheelchairAccessible')).toBe(false);
    expect(req.request.params.has('dayOfWeek')).toBe(false);
    expect(req.request.params.has('startTimeBefore')).toBe(false);
    expect(req.request.params.has('startTimeAfter')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  });

  it('search with all optional params sends all params', () => {
    service.search({
      q: 'grace',
      lat: 39.7,
      lng: -104.9,
      radiusMiles: 25,
      state: 'CO',
      denominationId: 'den-1',
      worshipStyle: 2,
      wheelchairAccessible: true,
      dayOfWeek: 0,
      startTimeAfter: '09:00',
      startTimeBefore: '12:00',
      page: 1,
      pageSize: 10,
    }).subscribe();
    const req = controller.expectOne(r => r.url.includes('/search'));
    expect(req.request.params.get('q')).toBe('grace');
    expect(req.request.params.get('lat')).toBe('39.7');
    expect(req.request.params.get('lng')).toBe('-104.9');
    expect(req.request.params.get('radiusMiles')).toBe('25');
    expect(req.request.params.get('state')).toBe('CO');
    expect(req.request.params.get('denominationId')).toBe('den-1');
    expect(req.request.params.get('worshipStyle')).toBe('2');
    expect(req.request.params.get('wheelchairAccessible')).toBe('true');
    expect(req.request.params.get('dayOfWeek')).toBe('0');
    expect(req.request.params.get('startTimeAfter')).toBe('09:00');
    expect(req.request.params.get('startTimeBefore')).toBe('12:00');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 10 });
  });

  it('getCorrections without status omits status param', () => {
    service.getCorrections().subscribe();
    const req = controller.expectOne(r => r.url.includes('/corrections'));
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  });

  it('getCorrections with status includes status param', () => {
    service.getCorrections(1).subscribe();
    const req = controller.expectOne(r => r.url.includes('/corrections'));
    expect(req.request.params.get('status')).toBe('1');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  });

  it('submitCorrection posts to /directory/api/corrections', () => {
    service.submitCorrection('id-1', 'phone', '555-old', '555-new').subscribe();
    const req = controller.expectOne('/directory/api/corrections');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'new-id' });
  });

  it('approveCorrection patches /directory/api/corrections/{id}/approve', () => {
    service.approveCorrection('c-1').subscribe();
    const req = controller.expectOne('/directory/api/corrections/c-1/approve');
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
  });

  it('rejectCorrection patches /directory/api/corrections/{id}/reject', () => {
    service.rejectCorrection('c-1').subscribe();
    const req = controller.expectOne('/directory/api/corrections/c-1/reject');
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
  });
});
