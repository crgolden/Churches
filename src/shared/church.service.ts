import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Campus, Church, Denomination, Ministry, PagedResult, SearchPagedResult, SearchParams, ServiceSchedule, UserCorrection } from './models';
import { DEFAULT_PAGE_SIZE, DirectoryApi, SearchParamNames } from './directory-api';

export interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  description: string | null;
}

export interface MinistryInput {
  name: string;
  description: string | null;
}

export interface CorrectionInput {
  churchId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
}

export interface CampusInput {
  name: string;
  street: string | null;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class ChurchApiService {
  private readonly http = inject(HttpClient);
  getDenominations(): Observable<Denomination[]> {
    return this.http.get<Denomination[]>(DirectoryApi.denominations);
  }

  getChurches(page = 1, pageSize = DEFAULT_PAGE_SIZE): Observable<PagedResult<Church>> {
    return this.http.get<PagedResult<Church>>(DirectoryApi.churches, {
      params: { page, pageSize }
    });
  }

  getChurchBySlug(slug: string): Observable<Church> {
    return this.http.get<Church>(DirectoryApi.church(slug));
  }

  search(params: SearchParams): Observable<SearchPagedResult> {
    let httpParams = new HttpParams();
    if (params.q) httpParams = httpParams.set(SearchParamNames.q, params.q);
    if (params.lat != null) httpParams = httpParams.set(SearchParamNames.lat, params.lat);
    if (params.lng != null) httpParams = httpParams.set(SearchParamNames.lng, params.lng);
    if (params.radiusMiles != null) httpParams = httpParams.set(SearchParamNames.radiusMiles, params.radiusMiles);
    if (params.state) httpParams = httpParams.set(SearchParamNames.state, params.state);
    if (params.denominationId) httpParams = httpParams.set(SearchParamNames.denominationId, params.denominationId);
    if (params.worshipStyle != null) httpParams = httpParams.set(SearchParamNames.worshipStyle, params.worshipStyle);
    if (params.wheelchairAccessible != null) httpParams = httpParams.set(SearchParamNames.wheelchairAccessible, params.wheelchairAccessible);
    if (params.dayOfWeek != null) httpParams = httpParams.set(SearchParamNames.dayOfWeek, params.dayOfWeek);
    if (params.startTimeBefore) httpParams = httpParams.set(SearchParamNames.startTimeBefore, params.startTimeBefore);
    if (params.startTimeAfter) httpParams = httpParams.set(SearchParamNames.startTimeAfter, params.startTimeAfter);
    if (params.sort) httpParams = httpParams.set(SearchParamNames.sort, params.sort);
    httpParams = httpParams.set(SearchParamNames.page, params.page ?? 1);
    httpParams = httpParams.set(SearchParamNames.pageSize, params.pageSize ?? 20);
    return this.http.get<SearchPagedResult>(DirectoryApi.search, { params: httpParams });
  }

  submitCorrection(churchId: string, field: string, oldValue: string | null, newValue: string): Observable<{ id: string }> {
    const body: CorrectionInput = { churchId, field, oldValue, newValue };
    return this.http.post<{ id: string }>(DirectoryApi.corrections, body);
  }

  getCorrections(status?: number, page = 1, pageSize = DEFAULT_PAGE_SIZE): Observable<PagedResult<UserCorrection>> {
    let params: Record<string, string | number> = { page, pageSize };
    if (status != null) params = { ...params, status };
    return this.http.get<PagedResult<UserCorrection>>(DirectoryApi.corrections, { params });
  }

  approveCorrection(id: string, survivingId?: string): Observable<void> {
    const params = survivingId ? { survivingId } : undefined;
    return this.http.patch<void>(DirectoryApi.approveCorrection(id), null, { params });
  }

  rejectCorrection(id: string): Observable<void> {
    return this.http.patch<void>(DirectoryApi.rejectCorrection(id), null);
  }

  createSchedule(churchId: string, input: ScheduleInput): Observable<ServiceSchedule> {
    return this.http.post<ServiceSchedule>(DirectoryApi.churchSchedules(churchId), input);
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(DirectoryApi.schedule(id));
  }

  createMinistry(churchId: string, input: MinistryInput): Observable<Ministry> {
    return this.http.post<Ministry>(DirectoryApi.churchMinistries(churchId), input);
  }

  deleteMinistry(id: string): Observable<void> {
    return this.http.delete<void>(DirectoryApi.ministry(id));
  }

  createCampus(churchId: string, input: CampusInput): Observable<Campus> {
    return this.http.post<Campus>(DirectoryApi.churchCampuses(churchId), input);
  }

  deleteCampus(id: string): Observable<void> {
    return this.http.delete<void>(DirectoryApi.campus(id));
  }
}
