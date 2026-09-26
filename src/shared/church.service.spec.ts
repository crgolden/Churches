import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { newCount, randomIntBetween } from '@crgolden/modules/testing';
import { ChurchApiService } from './church.service';
import { DEFAULT_PAGE_SIZE, DirectoryApi, SearchParamNames } from './directory-api';
import { DAYS_OF_WEEK, WORSHIP_STYLES } from './models';
import { HttpMethods } from '../bff/http-headers';

const OPTIONAL_SEARCH_PARAMS = [
  SearchParamNames.q,
  SearchParamNames.lat,
  SearchParamNames.lng,
  SearchParamNames.radiusMiles,
  SearchParamNames.state,
  SearchParamNames.denominationId,
  SearchParamNames.worshipStyle,
  SearchParamNames.wheelchairAccessible,
  SearchParamNames.dayOfWeek,
  SearchParamNames.startTimeBefore,
  SearchParamNames.startTimeAfter,
];

describe('ChurchApiService', () => {
  let service: ChurchApiService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChurchApiService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChurchApiService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('getDenominations hits the denominations route', () => {
    service.getDenominations().subscribe();
    controller.expectOne(DirectoryApi.denominations).flush([]);
  });

  it('getChurches hits the churches route with page params', () => {
    const page = newCount() + 1;
    const pageSize = newCount();
    service.getChurches(page, pageSize).subscribe();
    const req = controller.expectOne(r => r.url === DirectoryApi.churches);
    expect(req.request.params.get(SearchParamNames.page)).toBe(String(page));
    req.flush({ items: [], totalCount: 0, page, pageSize });
  });

  it('getChurchBySlug hits the church route for that slug', () => {
    const slug = crypto.randomUUID();
    service.getChurchBySlug(slug).subscribe();
    controller.expectOne(DirectoryApi.church(slug)).flush({});
  });

  it.each(OPTIONAL_SEARCH_PARAMS)('search with no optional params omits %s', name => {
    service.search({ page: 1, pageSize: DEFAULT_PAGE_SIZE }).subscribe();
    const req = controller.expectOne(r => r.url === DirectoryApi.search);
    expect(req.request.params.has(name)).toBe(false);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('search with no optional params still sends page', () => {
    const page = newCount();
    service.search({ page, pageSize: DEFAULT_PAGE_SIZE }).subscribe();
    const req = controller.expectOne(r => r.url === DirectoryApi.search);
    expect(req.request.params.get(SearchParamNames.page)).toBe(String(page));
    req.flush({ items: [], totalCount: 0, page, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('search with all optional params sends all params', () => {
    const q = crypto.randomUUID();
    const lat = randomIntBetween(-89, 90);
    const lng = randomIntBetween(-179, 180);
    const radiusMiles = newCount();
    const state = crypto.randomUUID();
    const denominationId = crypto.randomUUID();
    const worshipStyle = WORSHIP_STYLES[randomIntBetween(0, WORSHIP_STYLES.length)].value;
    const dayOfWeek = DAYS_OF_WEEK[randomIntBetween(0, DAYS_OF_WEEK.length)].value;
    const pageSize = newCount();
    const startTimeAfter = crypto.randomUUID();
    const startTimeBefore = crypto.randomUUID();
    service
      .search({
        q,
        lat,
        lng,
        radiusMiles,
        state,
        denominationId,
        worshipStyle,
        wheelchairAccessible: true,
        dayOfWeek,
        startTimeAfter,
        startTimeBefore,
        page: 1,
        pageSize,
      })
      .subscribe();
    const req = controller.expectOne(r => r.url === DirectoryApi.search);
    expect(req.request.params.get(SearchParamNames.q)).toBe(q);
    expect(req.request.params.get(SearchParamNames.lat)).toBe(String(lat));
    expect(req.request.params.get(SearchParamNames.lng)).toBe(String(lng));
    expect(req.request.params.get(SearchParamNames.radiusMiles)).toBe(String(radiusMiles));
    expect(req.request.params.get(SearchParamNames.state)).toBe(state);
    expect(req.request.params.get(SearchParamNames.denominationId)).toBe(denominationId);
    expect(req.request.params.get(SearchParamNames.worshipStyle)).toBe(String(worshipStyle));
    expect(req.request.params.get(SearchParamNames.wheelchairAccessible)).toBe(String(true));
    expect(req.request.params.get(SearchParamNames.dayOfWeek)).toBe(String(dayOfWeek));
    expect(req.request.params.get(SearchParamNames.startTimeAfter)).toBe(startTimeAfter);
    expect(req.request.params.get(SearchParamNames.startTimeBefore)).toBe(startTimeBefore);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize });
  });

  it('getCorrections without status omits status param', () => {
    service.getCorrections().subscribe();
    const req = controller.expectOne(r => r.url === DirectoryApi.corrections);
    expect(req.request.params.has(SearchParamNames.status)).toBe(false);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('getCorrections with status includes status param', () => {
    const status = newCount();
    service.getCorrections(status).subscribe();
    const req = controller.expectOne(r => r.url === DirectoryApi.corrections);
    expect(req.request.params.get(SearchParamNames.status)).toBe(String(status));
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('submitCorrection posts to the corrections route', () => {
    service.submitCorrection(crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()).subscribe();
    const req = controller.expectOne(DirectoryApi.corrections);
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush({ id: crypto.randomUUID() });
  });

  it('approveCorrection patches the approve route for that correction', () => {
    const id = crypto.randomUUID();
    service.approveCorrection(id).subscribe();
    const req = controller.expectOne(DirectoryApi.approveCorrection(id));
    expect(req.request.method).toBe(HttpMethods.patch);
    req.flush(null);
  });

  it('rejectCorrection patches the reject route for that correction', () => {
    const id = crypto.randomUUID();
    service.rejectCorrection(id).subscribe();
    const req = controller.expectOne(DirectoryApi.rejectCorrection(id));
    expect(req.request.method).toBe(HttpMethods.patch);
    req.flush(null);
  });
});
