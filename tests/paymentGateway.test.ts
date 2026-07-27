/**
 * tests/paymentGateway.test.ts — src/core/payments/PaymentGateway.ts
 *
 * The rule O7's submit button and any future gateway both answer to.
 */
import {
  DEFAULT_PRESETS,
  isValidTopUpAmount,
  MIN_TOPUP_CENTIMES,
} from '@/core/payments/PaymentGateway';

describe('isValidTopUpAmount', () => {
  it('accepts the minimum and above', () => {
    expect(isValidTopUpAmount(MIN_TOPUP_CENTIMES)).toBe(true);
    expect(isValidTopUpAmount(100_000)).toBe(true);
  });

  it('refuses below the minimum', () => {
    expect(isValidTopUpAmount(MIN_TOPUP_CENTIMES - 1)).toBe(false);
    expect(isValidTopUpAmount(0)).toBe(false);
    expect(isValidTopUpAmount(-5000)).toBe(false);
  });

  it('refuses fractional centimes — money is integers here', () => {
    expect(isValidTopUpAmount(2000.5)).toBe(false);
  });
});

describe('the presets', () => {
  it('are all submittable', () => {
    for (const preset of DEFAULT_PRESETS) {
      expect(isValidTopUpAmount(preset)).toBe(true);
    }
  });

  it('are the 20 / 50 / 100 / 200 DH from O7', () => {
    expect([...DEFAULT_PRESETS]).toEqual([2000, 5000, 10_000, 20_000]);
  });
});
