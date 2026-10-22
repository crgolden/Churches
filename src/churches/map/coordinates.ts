export const UNGEOCODED_COORDINATE = 0;

export function isGeocoded(latitude: number, longitude: number): boolean {
  return latitude !== UNGEOCODED_COORDINATE || longitude !== UNGEOCODED_COORDINATE;
}
