/**
 * src/core/usecases/sortWashes.ts
 *
 * C1: "nearest by default; also fastest / cheapest / best rated".
 *
 * Sorting happens here rather than in SQL because the result set is already
 * bounded by the search radius, and re-querying the database every time the
 * user taps a different sort would be slower than reordering what is on
 * screen. Pure, so the ordering rules are testable.
 *
 * Every mode is total and stable: ties fall back to distance, so the list
 * never reshuffles between renders.
 */
import type { NearbyWash } from '@/core/domain/CarWash';

export const SORT_MODES = ['nearest', 'fastest', 'cheapest', 'rated'] as const;
export type SortMode = (typeof SORT_MODES)[number];

/** Washes with no price list sink below priced ones rather than sorting as free. */
const priceRank = (wash: NearbyWash) =>
  wash.priceFrom === null ? Number.POSITIVE_INFINITY : wash.priceFrom;

/**
 * A closed wash is never "fastest" — its wait is unknowable, not zero.
 * Same reasoning as queueStateFor().
 */
const waitRank = (wash: NearbyWash) =>
  wash.isOpen ? wash.waitMinutes : Number.POSITIVE_INFINITY;

/**
 * Rating descending, but an unrated wash ranks last rather than as zero, and
 * a single five-star review does not outrank a hundred at 4.8.
 */
const ratingRank = (wash: NearbyWash) => (wash.ratingCount === 0 ? -1 : wash.ratingAvg);

const comparators: Record<SortMode, (a: NearbyWash, b: NearbyWash) => number> = {
  nearest: (a, b) => a.distanceM - b.distanceM,
  fastest: (a, b) => waitRank(a) - waitRank(b),
  cheapest: (a, b) => priceRank(a) - priceRank(b),
  rated: (a, b) => ratingRank(b) - ratingRank(a) || b.ratingCount - a.ratingCount,
};

export function sortWashes(washes: readonly NearbyWash[], mode: SortMode): NearbyWash[] {
  const compare = comparators[mode];

  // Copy first: callers hand us query cache data, which must not be mutated.
  return [...washes].sort((a, b) => compare(a, b) || a.distanceM - b.distanceM);
}

/**
 * C1's search field. Matches name or address, accent- and case-insensitively,
 * so "medina" finds "Médina".
 */
export function filterWashes(washes: readonly NearbyWash[], query: string): NearbyWash[] {
  const needle = normalise(query);
  if (needle === '') return [...washes];

  return washes.filter(
    (wash) => normalise(wash.name).includes(needle) || normalise(wash.address).includes(needle),
  );
}

function normalise(value: string): string {
  return value
    .normalize('NFD')
    // strip combining marks, so "medina" matches "Médina"
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}
