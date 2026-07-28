/**
 * tests/sortWashes.test.ts — src/core/usecases/sortWashes.ts
 *
 * C1's four sort modes and its search field.
 */
import type { NearbyWash } from '@/core/domain/CarWash';
import { filterWashes, sortWashes } from '@/core/usecases/sortWashes';

const wash = (over: Partial<NearbyWash> & { id: string }): NearbyWash => ({
  name: 'Lavage',
  address: 'Casablanca',
  photos: [],
  latitude: 33.57,
  longitude: -7.59,
  distanceM: 1000,
  ratingAvg: 0,
  ratingCount: 0,
  baysCount: 1,
  carsAhead: 0,
  waitMinutes: 10,
  priceFrom: 3000,
  isOpen: true,
  ...over,
});

const ids = (list: readonly NearbyWash[]) => list.map((w) => w.id);

describe('nearest', () => {
  it('orders by distance', () => {
    const list = [
      wash({ id: 'far', distanceM: 5000 }),
      wash({ id: 'near', distanceM: 200 }),
      wash({ id: 'mid', distanceM: 1200 }),
    ];
    expect(ids(sortWashes(list, 'nearest'))).toEqual(['near', 'mid', 'far']);
  });
});

describe('fastest', () => {
  it('orders by wait', () => {
    const list = [
      wash({ id: 'slow', waitMinutes: 60 }),
      wash({ id: 'quick', waitMinutes: 5 }),
    ];
    expect(ids(sortWashes(list, 'fastest'))).toEqual(['quick', 'slow']);
  });

  it('never ranks a closed wash as fastest', () => {
    // Its wait is unknowable, not zero.
    const list = [
      wash({ id: 'closed', waitMinutes: 0, isOpen: false }),
      wash({ id: 'open', waitMinutes: 45 }),
    ];
    expect(ids(sortWashes(list, 'fastest'))).toEqual(['open', 'closed']);
  });
});

describe('cheapest', () => {
  it('orders by the lowest price', () => {
    const list = [
      wash({ id: 'dear', priceFrom: 8000 }),
      wash({ id: 'cheap', priceFrom: 2000 }),
    ];
    expect(ids(sortWashes(list, 'cheapest'))).toEqual(['cheap', 'dear']);
  });

  it('sinks a wash with no price list rather than treating it as free', () => {
    const list = [
      wash({ id: 'unpriced', priceFrom: null }),
      wash({ id: 'priced', priceFrom: 9000 }),
    ];
    expect(ids(sortWashes(list, 'cheapest'))).toEqual(['priced', 'unpriced']);
  });
});

describe('best rated', () => {
  it('orders by rating, highest first', () => {
    const list = [
      wash({ id: 'ok', ratingAvg: 3.2, ratingCount: 40 }),
      wash({ id: 'great', ratingAvg: 4.8, ratingCount: 40 }),
    ];
    expect(ids(sortWashes(list, 'rated'))).toEqual(['great', 'ok']);
  });

  it('breaks a tie on the number of reviews', () => {
    const list = [
      wash({ id: 'few', ratingAvg: 4.5, ratingCount: 3 }),
      wash({ id: 'many', ratingAvg: 4.5, ratingCount: 120 }),
    ];
    expect(ids(sortWashes(list, 'rated'))).toEqual(['many', 'few']);
  });

  it('puts an unrated wash last rather than treating it as zero stars', () => {
    const list = [
      wash({ id: 'unrated', ratingAvg: 0, ratingCount: 0 }),
      wash({ id: 'poor', ratingAvg: 1.5, ratingCount: 10 }),
    ];
    expect(ids(sortWashes(list, 'rated'))).toEqual(['poor', 'unrated']);
  });
});

describe('every mode', () => {
  it('falls back to distance so the order is stable', () => {
    const list = [
      wash({ id: 'b', waitMinutes: 20, distanceM: 900 }),
      wash({ id: 'a', waitMinutes: 20, distanceM: 100 }),
    ];
    expect(ids(sortWashes(list, 'fastest'))).toEqual(['a', 'b']);
  });

  it('does not mutate the input — it comes from the query cache', () => {
    const list = [wash({ id: 'far', distanceM: 9000 }), wash({ id: 'near', distanceM: 10 })];
    const before = ids(list);
    sortWashes(list, 'nearest');
    expect(ids(list)).toEqual(before);
  });
});

describe('search', () => {
  const list = [
    wash({ id: 'medina', name: 'Lavage Médina' }),
    wash({ id: 'port', name: 'Wash du Port', address: 'Boulevard Anfa' }),
  ];

  it('returns everything for an empty query', () => {
    expect(filterWashes(list, '')).toHaveLength(2);
    expect(filterWashes(list, '   ')).toHaveLength(2);
  });

  it('matches on name, ignoring case and accents', () => {
    expect(ids(filterWashes(list, 'medina'))).toEqual(['medina']);
    expect(ids(filterWashes(list, 'MÉDINA'))).toEqual(['medina']);
  });

  it('matches on address too', () => {
    expect(ids(filterWashes(list, 'anfa'))).toEqual(['port']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterWashes(list, 'zzz')).toEqual([]);
  });
});
