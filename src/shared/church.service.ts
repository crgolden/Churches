import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Campus, Church, Denomination, Ministry, PagedResult, SearchPagedResult, SearchParams, ServiceSchedule, UserCorrection } from './models';

export interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  description: string | null;
}

export interface MinistryInput {
  name: string;
  description: string | null;
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
  private readonly base = '/directory/api';

  getDenominations(): Observable<Denomination[]> {
    return this.http.get<Denomination[]>(`${this.base}/denominations`);
  }

  getChurches(page = 1, pageSize = 20): Observable<PagedResult<Church>> {
    return this.http.get<PagedResult<Church>>(`${this.base}/churches`, {
      params: { page, pageSize }
    });
  }

  getChurchBySlug(slug: string): Observable<Church> {
    return this.http.get<Church>(`${this.base}/churches/${slug}`);
  }

  search(params: SearchParams): Observable<SearchPagedResult> {
    let httpParams = new HttpParams();
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.lat != null) httpParams = httpParams.set('lat', params.lat);
    if (params.lng != null) httpParams = httpParams.set('lng', params.lng);
    if (params.radiusMiles != null) httpParams = httpParams.set('radiusMiles', params.radiusMiles);
    if (params.state) httpParams = httpParams.set('state', params.state);
    if (params.denominationId) httpParams = httpParams.set('denominationId', params.denominationId);
    if (params.worshipStyle != null) httpParams = httpParams.set('worshipStyle', params.worshipStyle);
    if (params.wheelchairAccessible != null) httpParams = httpParams.set('wheelchairAccessible', params.wheelchairAccessible);
    if (params.dayOfWeek != null) httpParams = httpParams.set('dayOfWeek', params.dayOfWeek);
    if (params.startTimeBefore) httpParams = httpParams.set('startTimeBefore', params.startTimeBefore);
    if (params.startTimeAfter) httpParams = httpParams.set('startTimeAfter', params.startTimeAfter);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    httpParams = httpParams.set('page', params.page ?? 1);
    httpParams = httpParams.set('pageSize', params.pageSize ?? 20);
    return this.http.get<SearchPagedResult>(`${this.base}/search`, { params: httpParams });
  }

  submitCorrection(churchId: string, field: string, oldValue: string | null, newValue: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/corrections`, { churchId, field, oldValue, newValue });
  }

  getCorrections(status?: number, page = 1, pageSize = 20): Observable<PagedResult<UserCorrection>> {
    let params: Record<string, string | number> = { page, pageSize };
    if (status != null) params = { ...params, status };
    return this.http.get<PagedResult<UserCorrection>>(`${this.base}/corrections`, { params });
  }

  approveCorrection(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/corrections/${id}/approve`, null);
  }

  rejectCorrection(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/corrections/${id}/reject`, null);
  }

  // --- Moderator curation of church children (requires the churches.mod claim) ---

  createSchedule(churchId: string, input: ScheduleInput): Observable<ServiceSchedule> {
    return this.http.post<ServiceSchedule>(`${this.base}/churches/${churchId}/schedules`, input);
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/schedules/${id}`);
  }

  createMinistry(churchId: string, input: MinistryInput): Observable<Ministry> {
    return this.http.post<Ministry>(`${this.base}/churches/${churchId}/ministries`, input);
  }

  deleteMinistry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/ministries/${id}`);
  }

  createCampus(churchId: string, input: CampusInput): Observable<Campus> {
    return this.http.post<Campus>(`${this.base}/churches/${churchId}/campuses`, input);
  }

  deleteCampus(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/campuses/${id}`);
  }
}
