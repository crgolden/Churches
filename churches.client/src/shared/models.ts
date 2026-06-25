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

// U.S. states + DC, used to back the State autocomplete. The Directory API expects the 2-letter
// `code`; `name` is what the user can type/select via the <datalist>.
export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
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
