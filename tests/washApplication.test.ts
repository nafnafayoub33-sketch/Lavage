import {
  canSubmit,
  firstIncompleteStep,
  isStepComplete,
  isValidTimeOfDay,
  MAX_BAYS,
  MAX_PHOTOS,
  MIN_PHOTOS,
  problemsFor,
  problemsForStep,
  type WashApplicationDraft,
} from '@/core/usecases/washApplication';

/** A complete, valid application. Each test spoils exactly one thing. */
const complete: WashApplicationDraft = {
  name: 'Lavage Al Amal',
  description: 'Rapide et propre',
  address: '12 rue Zerktouni',
  city: 'Casablanca',
  phone: '+212600112233',
  pin: { latitude: 33.5749, longitude: -7.5898 },
  photos: ['a.jpg', 'b.jpg', 'c.jpg'],
  baysCount: 3,
  opensAt: '07:30',
  closesAt: '21:00',
};

const spoil = (patch: Partial<WashApplicationDraft>): WashApplicationDraft => ({
  ...complete,
  ...patch,
});

describe('a complete application', () => {
  it('has no problems and can be submitted', () => {
    expect(problemsFor(complete)).toEqual([]);
    expect(canSubmit(complete)).toBe(true);
  });

  it('reports every step complete', () => {
    for (const step of ['identity', 'location', 'photos', 'details'] as const) {
      expect(isStepComplete(complete, step)).toBe(true);
    }
  });

  it('accepts an empty description — it is optional', () => {
    expect(canSubmit(spoil({ description: '' }))).toBe(true);
  });

  it('accepts an empty phone — the owner already has one on their profile', () => {
    expect(canSubmit(spoil({ phone: '' }))).toBe(true);
  });
});

describe('identity', () => {
  it.each(['', '   '])('rejects a name of %p', (name) => {
    expect(problemsFor(spoil({ name }))).toContain('nameMissing');
    expect(isStepComplete(spoil({ name }), 'identity')).toBe(false);
  });
});

describe('location', () => {
  it('rejects a missing address', () => {
    expect(problemsFor(spoil({ address: '  ' }))).toContain('addressMissing');
  });

  it('rejects a missing city', () => {
    expect(problemsFor(spoil({ city: '' }))).toContain('cityMissing');
  });

  it('rejects no pin at all', () => {
    expect(problemsFor(spoil({ pin: null }))).toContain('pinMissing');
  });

  it('rejects a swapped latitude and longitude', () => {
    // The Casablanca pin with its arguments the wrong way round. This is the
    // single most likely way to end up with a wash nobody can find.
    const swapped = spoil({ pin: { latitude: -7.5898, longitude: 33.5749 } });
    expect(problemsFor(swapped)).toContain('pinOutsideMorocco');
  });

  it('rejects a pin in Paris', () => {
    const paris = spoil({ pin: { latitude: 48.8566, longitude: 2.3522 } });
    expect(problemsFor(paris)).toContain('pinOutsideMorocco');
  });

  it.each([
    ['Tangier', 35.7595, -5.834],
    ['Casablanca', 33.5749, -7.5898],
    ['Dakhla', 23.6848, -15.958],
  ])('accepts a pin in %s', (_city, latitude, longitude) => {
    expect(problemsFor(spoil({ pin: { latitude, longitude } }))).toEqual([]);
  });
});

describe('photos', () => {
  it(`rejects fewer than ${MIN_PHOTOS}`, () => {
    expect(problemsFor(spoil({ photos: ['a.jpg', 'b.jpg'] }))).toContain('tooFewPhotos');
  });

  it(`accepts exactly ${MIN_PHOTOS}`, () => {
    expect(problemsForStep(spoil({ photos: ['a', 'b', 'c'] }), 'photos')).toEqual([]);
  });

  it(`rejects more than ${MAX_PHOTOS}`, () => {
    const tooMany = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => `${i}.jpg`);
    expect(problemsFor(spoil({ photos: tooMany }))).toContain('tooManyPhotos');
  });
});

describe('details', () => {
  it.each([0, -1, 1.5, MAX_BAYS + 1])('rejects %p bays', (baysCount) => {
    expect(problemsFor(spoil({ baysCount }))).toContain('baysOutOfRange');
  });

  it('rejects identical opening and closing hours', () => {
    // A wash that is never open, and 0004 would report is_open false forever
    // without ever saying why.
    const never = spoil({ opensAt: '08:00', closesAt: '08:00' });
    expect(problemsFor(never)).toContain('hoursIdentical');
  });

  it('accepts hours that cross midnight', () => {
    expect(problemsFor(spoil({ opensAt: '20:00', closesAt: '02:00' }))).toEqual([]);
  });
});

describe('problems are grouped by the step that can fix them', () => {
  it('puts the address on the location step, not identity', () => {
    const draft = spoil({ address: '' });
    expect(problemsForStep(draft, 'location')).toContain('addressMissing');
    expect(problemsForStep(draft, 'identity')).toEqual([]);
  });

  it('leaves other steps complete when one is not', () => {
    const draft = spoil({ photos: [] });
    expect(isStepComplete(draft, 'photos')).toBe(false);
    expect(isStepComplete(draft, 'identity')).toBe(true);
    expect(isStepComplete(draft, 'details')).toBe(true);
  });
});

describe('firstIncompleteStep', () => {
  it('is the earliest step with something missing', () => {
    expect(firstIncompleteStep(spoil({ name: '', photos: [] }))).toBe('identity');
    expect(firstIncompleteStep(spoil({ photos: [] }))).toBe('photos');
    expect(firstIncompleteStep(spoil({ baysCount: 0 }))).toBe('details');
  });

  it('is the last step when nothing is missing, so an edit lands on review', () => {
    expect(firstIncompleteStep(complete)).toBe('details');
  });
});

describe('isValidTimeOfDay', () => {
  it.each(['00:00', '07:30', '23:59'])('accepts %p', (value) => {
    expect(isValidTimeOfDay(value)).toBe(true);
  });

  it.each(['24:00', '7:30', '07:60', '0730', '', 'ab:cd'])('rejects %p', (value) => {
    expect(isValidTimeOfDay(value)).toBe(false);
  });
});
