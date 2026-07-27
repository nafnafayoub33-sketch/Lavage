/**
 * tests/serviceDraft.test.ts — src/core/usecases/serviceDraft.ts
 *
 * O6's validation. Duration matters beyond this screen: queue_state()
 * averages it into the wait time C1 shows and C6 counts down.
 */
import {
  MAX_DURATION_MIN,
  MIN_DURATION_MIN,
  parseServiceDraft,
  PLAUSIBLE_DURATION_MAX,
  PLAUSIBLE_DURATION_MIN,
} from '@/core/usecases/serviceDraft';

const draft = (over: Partial<Parameters<typeof parseServiceDraft>[0]> = {}) =>
  parseServiceDraft({ name: 'Complet', priceDirhams: '50', durationMin: '30', ...over });

describe('a good entry', () => {
  it('converts dirhams to centimes', () => {
    const result = draft({ priceDirhams: '50' });
    expect(result).toMatchObject({ ok: true, priceCentimes: 5000, durationMin: 30 });
  });

  it('trims the name', () => {
    expect(draft({ name: '  Complet  ' })).toMatchObject({ ok: true, name: 'Complet' });
  });

  it('allows a free service', () => {
    expect(draft({ priceDirhams: '0' })).toMatchObject({ ok: true, priceCentimes: 0 });
  });
});

describe('refusals', () => {
  it('needs a name', () => {
    expect(draft({ name: '   ' })).toEqual({ ok: false, reason: 'name' });
  });

  it('needs a price', () => {
    expect(draft({ priceDirhams: '' })).toEqual({ ok: false, reason: 'price' });
  });

  it('refuses a duration outside the workable range', () => {
    expect(draft({ durationMin: String(MIN_DURATION_MIN - 1) })).toEqual({
      ok: false,
      reason: 'duration',
    });
    expect(draft({ durationMin: String(MAX_DURATION_MIN + 1) })).toEqual({
      ok: false,
      reason: 'duration',
    });
  });
});

describe('the duration warning', () => {
  it('stays quiet for an ordinary wash', () => {
    expect(draft({ durationMin: '30' })).toMatchObject({ warnDuration: false });
  });

  it('warns at the implausible ends without refusing them', () => {
    // An owner with a genuine five-minute rinse is not argued with, but a
    // three-minute full valet would wreck every estimate in the app.
    const quick = draft({ durationMin: String(PLAUSIBLE_DURATION_MIN - 1) });
    expect(quick).toMatchObject({ ok: true, warnDuration: true });

    const slow = draft({ durationMin: String(PLAUSIBLE_DURATION_MAX + 1) });
    expect(slow).toMatchObject({ ok: true, warnDuration: true });
  });
});
