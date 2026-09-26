export const CSRF_HEADER = 'X-CSRF';

export const CSRF_HEADER_VALUE = '1';

export const REQUEST_ID_HEADER = 'X-Request-ID';

export const COOKIE_HEADER = 'Cookie';

export const MISSING_CSRF_ERROR = `Missing ${CSRF_HEADER} header`;

export const BFF_SEGMENT = 'bff';

export const BFF_PREFIX = `/${BFF_SEGMENT}`;

export const BffRoutes = {
  login: '/login',
  callback: '/callback',
  user: '/user',
  logout: '/logout',
} as const;

export const BffPaths = {
  login: `${BFF_PREFIX}${BffRoutes.login}`,
  callback: `${BFF_PREFIX}${BffRoutes.callback}`,
  user: `${BFF_PREFIX}${BffRoutes.user}`,
  logout: `${BFF_PREFIX}${BffRoutes.logout}`,
} as const;

export const BFF_USER_RELATIVE_PATH = `${BFF_SEGMENT}${BffRoutes.user}`;

export const SID_QUERY_PARAMETER = 'sid';

export const RETURN_URL_QUERY_PARAMETER = 'returnUrl';

export const ClaimTypes = {
  logoutUrl: 'bff:logout_url',
  moderator: 'churches.mod',
  name: 'name',
  sid: 'sid',
  subject: 'sub',
} as const;

export const MODERATOR_CLAIM_VALUE = 'true';
