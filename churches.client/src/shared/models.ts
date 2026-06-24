export interface Church {
  id: string;
  canonicalName: string;
  slug: string;
  latitude: number;
  longitude: number;
  street: string | null;
  city: string;
  state: string;
  zip: string;
  phoneNumber: string | null;
  website: string | null;
  emailAddress: string | null;
  denominationId: string | null;
  worshipStyle: number;
  primaryLanguage: string;
  acceptsLGBTQ: boolean | null;
  wheelchairAccessible: boolean | null;
  hasNursery: boolean | null;
  hasYouthProgram: boolean | null;
  confidenceScore: number;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  // Present only on the church-detail response.
  schedules?: ServiceSchedule[];
  ministries?: Ministry[];
  campuses?: Campus[];
}

export interface ServiceSchedule {
  id: string;
  churchId: string;
  campusId: string | null;
  dayOfWeek: number;
  startTime: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ministry {
  id: string;
  churchId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campus {
  id: string;
  churchId: string;
  name: string;
  street: string | null;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SearchResult {
  church: Church;
  distanceMiles: number | null;
}

export interface SearchPagedResult {
  items: SearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface UserCorrection {
  id: string;
  churchId: string;
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  status: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  churchName: string | null;
}

export interface SearchParams {
  q?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  state?: string;
  denominationId?: string;
  worshipStyle?: number;
  wheelchairAccessible?: boolean;
  dayOfWeek?: number;
  startTimeBefore?: string;
  startTimeAfter?: string;
  page?: number;
  pageSize?: number;
}

export interface Denomination {
  id: string;
  name: string;
}

export const WORSHIP_STYLES: { value: number; label: string }[] = [
  { value: 1, label: 'Traditional' },
  { value: 2, label: 'Contemporary' },
  { value: 3, label: 'Blended' },
  { value: 4, label: 'Charismatic' },
  { value: 5, label: 'Liturgical' },
];

// Matches .NET System.DayOfWeek (Sunday = 0 ... Saturday = 6), the value the
// Directory API binds for the ServiceSchedules day filter.
export const DAYS_OF_WEEK: { value: number; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];
