export const DIRECTORY_API_PREFIX = '/directory/api';

export const DEFAULT_PAGE_SIZE = 20;

const CHURCHES_ROUTE = '/churches';

export const DirectoryRoutes = {
  denominations: '/denominations',
  churches: CHURCHES_ROUTE,
  search: '/search',
  corrections: '/corrections',
  schedules: '/schedules',
  ministries: '/ministries',
  campuses: '/campuses',
  approve: '/approve',
  reject: '/reject',
  church: (slugOrId: string): string => `${CHURCHES_ROUTE}/${slugOrId}`,
} as const;

export const SearchParamNames = {
  q: 'q',
  lat: 'lat',
  lng: 'lng',
  radiusMiles: 'radiusMiles',
  state: 'state',
  denominationId: 'denominationId',
  worshipStyle: 'worshipStyle',
  wheelchairAccessible: 'wheelchairAccessible',
  dayOfWeek: 'dayOfWeek',
  startTimeBefore: 'startTimeBefore',
  startTimeAfter: 'startTimeAfter',
  sort: 'sort',
  page: 'page',
  pageSize: 'pageSize',
  status: 'status',
  survivingId: 'survivingId',
} as const;

export const DirectoryApi = {
  denominations: `${DIRECTORY_API_PREFIX}${DirectoryRoutes.denominations}`,
  churches: `${DIRECTORY_API_PREFIX}${DirectoryRoutes.churches}`,
  search: `${DIRECTORY_API_PREFIX}${DirectoryRoutes.search}`,
  corrections: `${DIRECTORY_API_PREFIX}${DirectoryRoutes.corrections}`,
  church: (slugOrId: string): string => `${DIRECTORY_API_PREFIX}${DirectoryRoutes.church(slugOrId)}`,
  approveCorrection: (id: string): string =>
    `${DIRECTORY_API_PREFIX}${DirectoryRoutes.corrections}/${id}${DirectoryRoutes.approve}`,
  rejectCorrection: (id: string): string =>
    `${DIRECTORY_API_PREFIX}${DirectoryRoutes.corrections}/${id}${DirectoryRoutes.reject}`,
  churchSchedules: (churchId: string): string =>
    `${DIRECTORY_API_PREFIX}${DirectoryRoutes.churches}/${churchId}${DirectoryRoutes.schedules}`,
  schedule: (id: string): string => `${DIRECTORY_API_PREFIX}${DirectoryRoutes.schedules}/${id}`,
  churchMinistries: (churchId: string): string =>
    `${DIRECTORY_API_PREFIX}${DirectoryRoutes.churches}/${churchId}${DirectoryRoutes.ministries}`,
  ministry: (id: string): string => `${DIRECTORY_API_PREFIX}${DirectoryRoutes.ministries}/${id}`,
  churchCampuses: (churchId: string): string =>
    `${DIRECTORY_API_PREFIX}${DirectoryRoutes.churches}/${churchId}${DirectoryRoutes.campuses}`,
  campus: (id: string): string => `${DIRECTORY_API_PREFIX}${DirectoryRoutes.campuses}/${id}`,
} as const;
