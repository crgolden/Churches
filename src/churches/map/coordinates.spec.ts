import { randomIntBetween } from '@crgolden/modules/testing';
import { isGeocoded } from './coordinates';

describe('isGeocoded', () => {
  it('treats the (0,0) sentinel as not geocoded', () => {
    expect(isGeocoded(0, 0)).toBe(false);
  });

  it('keeps a point on the equator', () => {
    const longitude = randomIntBetween(-179, 0);

    expect(isGeocoded(0, longitude)).toBe(true);
  });

  it('keeps a point on the prime meridian', () => {
    const latitude = randomIntBetween(1, 90);

    expect(isGeocoded(latitude, 0)).toBe(true);
  });
});
