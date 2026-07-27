/**
 * src/core/usecases/serviceDraft.ts
 *
 * Validating a price-list entry, and judging whether its duration is
 * believable.
 *
 * O6: "Duration drives the wait estimate — warn when a value is
 * unrealistic". A warning, not a block: an owner with a genuine 5-minute
 * rinse should not be argued with, but a 3-minute full valet would quietly
 * wreck every wait time C1 shows.
 */
export const MIN_DURATION_MIN = 3;
export const MAX_DURATION_MIN = 240;

/** Outside this, the number is probably a typo rather than a business model. */
export const PLAUSIBLE_DURATION_MIN = 8;
export const PLAUSIBLE_DURATION_MAX = 120;

export type ServiceDraftInput = {
  name: string;
  /** what the owner typed, in whole dirhams */
  priceDirhams: string;
  durationMin: string;
};

export type ServiceDraftResult =
  | { ok: true; name: string; priceCentimes: number; durationMin: number; warnDuration: boolean }
  | { ok: false; reason: 'name' | 'price' | 'duration' };

export function parseServiceDraft(input: ServiceDraftInput): ServiceDraftResult {
  const name = input.name.trim();
  if (name === '') return { ok: false, reason: 'name' };

  const dirhams = Number.parseInt(input.priceDirhams, 10);
  if (Number.isNaN(dirhams) || dirhams < 0) return { ok: false, reason: 'price' };

  const durationMin = Number.parseInt(input.durationMin, 10);
  if (
    Number.isNaN(durationMin) ||
    durationMin < MIN_DURATION_MIN ||
    durationMin > MAX_DURATION_MIN
  ) {
    return { ok: false, reason: 'duration' };
  }

  return {
    ok: true,
    name,
    // Money is centimes everywhere below the UI.
    priceCentimes: dirhams * 100,
    durationMin,
    warnDuration:
      durationMin < PLAUSIBLE_DURATION_MIN || durationMin > PLAUSIBLE_DURATION_MAX,
  };
}
