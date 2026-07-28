/**
 * tests/phone.test.ts — src/core/usecases/phone.ts
 *
 * Moroccan mobile numbers, as people actually type them.
 */
import {
  COUNTRY_PREFIX,
  formatNational,
  isComplete,
  isValidMobile,
  toE164,
  toNationalDigits,
} from '@/core/usecases/phone';

describe('toNationalDigits', () => {
  it.each([
    ['a spaced local number', '06 12 34 56 78', '612345678'],
    ['a bare local number', '0612345678', '612345678'],
    ['E.164', '+212612345678', '612345678'],
    ['a country code with no plus', '212612345678', '612345678'],
    ['the national number already', '612345678', '612345678'],
    ['dashes and brackets', '(06) 12-34-56-78', '612345678'],
    ['a country code and a trunk zero together', '+212 0612345678', '612345678'],
  ])('normalises %s', (_label, input, expected) => {
    expect(toNationalDigits(input)).toBe(expected);
  });

  it('caps at nine digits so the field cannot overflow', () => {
    expect(toNationalDigits('0612345678999')).toBe('612345678');
  });

  it('keeps a partial number partial while the user is still typing', () => {
    expect(toNationalDigits('061')).toBe('61');
  });

  it('yields nothing from text with no digits', () => {
    expect(toNationalDigits('abc')).toBe('');
  });
});

describe('isComplete', () => {
  it('is true only at nine digits', () => {
    expect(isComplete('61234567')).toBe(false);
    expect(isComplete('612345678')).toBe(true);
  });
});

describe('isValidMobile', () => {
  it('accepts the 6 and 7 mobile ranges', () => {
    expect(isValidMobile('612345678')).toBe(true);
    expect(isValidMobile('712345678')).toBe(true);
  });

  it('rejects a 5 landline, which cannot receive an SMS', () => {
    expect(isValidMobile('512345678')).toBe(false);
  });

  it('rejects an incomplete number — that is "not yet", not "wrong"', () => {
    expect(isValidMobile('61234')).toBe(false);
  });
});

describe('toE164', () => {
  it('prefixes the country code', () => {
    expect(toE164('612345678')).toBe(`${COUNTRY_PREFIX}612345678`);
  });

  it('throws rather than hand a malformed number to the SMS provider', () => {
    expect(() => toE164('512345678')).toThrow();
    expect(() => toE164('61234')).toThrow();
  });
});

describe('formatNational', () => {
  it('groups in threes for display', () => {
    expect(formatNational('612345678')).toBe('612 345 678');
  });

  it('groups a partial number without a trailing space', () => {
    expect(formatNational('6123')).toBe('612 3');
    expect(formatNational('612')).toBe('612');
  });
});
