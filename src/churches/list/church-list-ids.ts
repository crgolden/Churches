export const CHURCH_NAME_ID_PREFIX = 'church-name-';

export function churchNameId(index: number): string {
  return `${CHURCH_NAME_ID_PREFIX}${index}`;
}

export const CHURCH_DISTANCE_ID_PREFIX = 'church-distance-';

export function churchDistanceId(index: number): string {
  return `${CHURCH_DISTANCE_ID_PREFIX}${index}`;
}

export const PAGE_NUMBER_ID_PREFIX = 'btn-page-';

export function pageNumberId(index: number): string {
  return `${PAGE_NUMBER_ID_PREFIX}${index}`;
}
