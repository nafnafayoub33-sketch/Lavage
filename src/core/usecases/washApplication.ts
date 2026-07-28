/**
 * src/core/usecases/washApplication.ts
 *
 * O1's rules. Framework-free: no React, no Supabase, no i18n — the caller
 * turns a `WashApplicationProblem` into a sentence.
 *
 * The same rules are enforced again in 0014's `register_car_wash`. That is
 * not duplication for its own sake: the database has to refuse a bad
 * application whoever sends it, and the screen has to be able to say which
 * step is incomplete before anybody presses submit. The database answers
 * "no"; this answers "not yet, and here is what is missing".
 */

/** The map picker's minimum. Below Morocco's bounds a pin is a mistake. */
export const MOROCCO_BOUNDS = {
  minLat: 20.0,
  maxLat: 36.5,
  minLng: -18.0,
  maxLng: -0.5,
} as const;

/**
 * SCREENS.md says three. A single blurry photo is what an empty forecourt
 * looks like to a client deciding where to drive.
 */
export const MIN_PHOTOS = 3;

/** Beyond this the card in C1 stops being scannable. */
export const MAX_PHOTOS = 8;

export const MAX_BAYS = 20;

export type WashApplicationDraft = {
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  pin: { latitude: number; longitude: number } | null;
  /** local file URIs before upload, storage paths after */
  photos: readonly string[];
  baysCount: number;
  opensAt: string;
  closesAt: string;
};

export type WashApplicationProblem =
  | 'nameMissing'
  | 'addressMissing'
  | 'cityMissing'
  | 'pinMissing'
  | 'pinOutsideMorocco'
  | 'tooFewPhotos'
  | 'tooManyPhotos'
  | 'baysOutOfRange'
  | 'hoursIdentical';

/**
 * O1 is a stepper, so problems are grouped by the step that can fix them.
 * A step is complete when it has no problems; the screen advances on that,
 * not on a separate notion of progress that could disagree.
 */
export type WashApplicationStep = 'identity' | 'location' | 'photos' | 'details';

export const WASH_APPLICATION_STEPS: readonly WashApplicationStep[] = [
  'identity',
  'location',
  'photos',
  'details',
] as const;

const STEP_OF: Record<WashApplicationProblem, WashApplicationStep> = {
  nameMissing: 'identity',
  addressMissing: 'location',
  cityMissing: 'location',
  pinMissing: 'location',
  pinOutsideMorocco: 'location',
  tooFewPhotos: 'photos',
  tooManyPhotos: 'photos',
  baysOutOfRange: 'details',
  hoursIdentical: 'details',
};

export function problemsFor(
  draft: WashApplicationDraft,
): readonly WashApplicationProblem[] {
  const problems: WashApplicationProblem[] = [];

  if (draft.name.trim() === '') problems.push('nameMissing');
  if (draft.address.trim() === '') problems.push('addressMissing');
  if (draft.city.trim() === '') problems.push('cityMissing');

  if (draft.pin === null) {
    problems.push('pinMissing');
  } else if (
    draft.pin.latitude < MOROCCO_BOUNDS.minLat ||
    draft.pin.latitude > MOROCCO_BOUNDS.maxLat ||
    draft.pin.longitude < MOROCCO_BOUNDS.minLng ||
    draft.pin.longitude > MOROCCO_BOUNDS.maxLng
  ) {
    // Almost always a swapped latitude and longitude, which puts Casablanca
    // in the Indian Ocean and produces a wash nobody can ever find.
    problems.push('pinOutsideMorocco');
  }

  if (draft.photos.length < MIN_PHOTOS) problems.push('tooFewPhotos');
  if (draft.photos.length > MAX_PHOTOS) problems.push('tooManyPhotos');

  if (
    !Number.isInteger(draft.baysCount) ||
    draft.baysCount < 1 ||
    draft.baysCount > MAX_BAYS
  ) {
    problems.push('baysOutOfRange');
  }

  // Equal hours means a wash that is never open, and 0004 would compute
  // `is_open` false forever without ever saying why.
  if (draft.opensAt === draft.closesAt) problems.push('hoursIdentical');

  return problems;
}

export function problemsForStep(
  draft: WashApplicationDraft,
  step: WashApplicationStep,
): readonly WashApplicationProblem[] {
  return problemsFor(draft).filter((problem) => STEP_OF[problem] === step);
}

export function isStepComplete(
  draft: WashApplicationDraft,
  step: WashApplicationStep,
): boolean {
  return problemsForStep(draft, step).length === 0;
}

export function canSubmit(draft: WashApplicationDraft): boolean {
  return problemsFor(draft).length === 0;
}

/**
 * The step the owner should be looking at: the first incomplete one, or the
 * last if the whole thing is ready. Used when O2 reopens the form for an
 * edit — dropping someone back on step one to fix a photo is rude.
 */
export function firstIncompleteStep(draft: WashApplicationDraft): WashApplicationStep {
  return (
    WASH_APPLICATION_STEPS.find((step) => !isStepComplete(draft, step)) ??
    WASH_APPLICATION_STEPS[WASH_APPLICATION_STEPS.length - 1]
  );
}

/** "07:30" — what the two time fields hold and what Postgres `time` takes. */
export function isValidTimeOfDay(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match !== null;
}
