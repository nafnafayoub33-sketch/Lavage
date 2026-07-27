/**
 * src/core/domain/CarWash.ts
 *
 * What C1 shows for each car wash. This is the shape nearby_car_washes()
 * returns, named for the domain rather than the query.
 *
 * Money is centimes, distance is metres, wait is whole minutes — all
 * integers, formatted only at render time.
 */
export type NearbyWash = {
  id: string;
  name: string;
  address: string;
  photos: string[];
  latitude: number;
  longitude: number;
  distanceM: number;
  ratingAvg: number;
  ratingCount: number;
  baysCount: number;
  carsAhead: number;
  waitMinutes: number;
  /** cheapest active service in centimes, or null when there is no price list */
  priceFrom: number | null;
  /** opening hours and the owner's "closed today" switch, nothing else */
  isOpen: boolean;
};
