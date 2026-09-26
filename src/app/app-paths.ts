export const AppPaths = {
  churches: 'churches',
  contribute: 'contribute',
  adminModeration: 'admin/moderation',
} as const;

export const HOME_URL = '/';

export const CHURCHES_URL = `/${AppPaths.churches}`;

export function churchUrl(slug: string): string {
  return `${CHURCHES_URL}/${slug}`;
}

export function contributeUrl(slug: string): string {
  return `/${AppPaths.contribute}/${slug}`;
}

export const MODERATION_URL = `/${AppPaths.adminModeration}`;

export const RouteDataKeys = {
  church: 'church',
  churchCount: 'churchCount',
  corrections: 'corrections',
  denominations: 'denominations',
  results: 'results',
} as const;
