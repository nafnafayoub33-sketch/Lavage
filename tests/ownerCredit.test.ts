/**
 * tests/ownerCredit.test.ts — src/core/usecases/ownerCredit.ts
 *
 * O3's amber warning and its red screen. Getting this wrong either hides a
 * wash without warning, or nags an owner who is fine.
 */
import {
  creditStateFor,
  isHiddenFromClients,
  LOW_BALANCE_CENTIMES,
} from '@/core/usecases/ownerCredit';

const state = (balanceCentimes: number, freeWashesLeft = 0) =>
  creditStateFor({ balanceCentimes, freeWashesLeft });

describe('while the welcome quota lasts', () => {
  it('is healthy regardless of the balance', () => {
    // A brand new wash has 100 free washes and no money. Warning it about
    // money would be wrong.
    expect(state(0, 100)).toBe('ok');
    expect(state(0, 1)).toBe('ok');
  });
});

describe('once the quota is spent', () => {
  it('is healthy above the threshold', () => {
    expect(state(LOW_BALANCE_CENTIMES)).toBe('ok');
    expect(state(50_000)).toBe('ok');
  });

  it('warns just below the threshold', () => {
    expect(state(LOW_BALANCE_CENTIMES - 1)).toBe('low');
    expect(state(100)).toBe('low');
  });

  it('is empty at zero — the wash is already out of search', () => {
    expect(state(0)).toBe('empty');
  });

  it('treats a negative balance as empty rather than low', () => {
    // The charge trigger subtracts without a floor, so this is reachable.
    expect(state(-500)).toBe('empty');
  });
});

describe('isHiddenFromClients', () => {
  it('matches exactly the condition 0004 filters on', () => {
    expect(isHiddenFromClients('empty')).toBe(true);
    expect(isHiddenFromClients('low')).toBe(false);
    expect(isHiddenFromClients('ok')).toBe(false);
  });
});
