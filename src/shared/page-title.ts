export const SITE_NAME = 'Churches';

export const PageTitles = {
  home: 'Find Your Church Home',
  browseChurches: 'Browse Churches',
  findAChurch: 'Find a Church',
  suggestACorrection: 'Suggest a Correction',
  moderation: 'Moderation',
  pageNotFound: 'Page Not Found',
} as const;

export function pageTitle(page: string): string {
  return `${page} | ${SITE_NAME}`;
}
