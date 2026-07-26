/**
 * src/core/usecases/phone.ts
 *
 * Moroccan mobile numbers. Pure — no React, no Supabase, no i18n.
 *
 * A3 shows a fixed +212 prefix, so the user types the national part only.
 * People write it every which way: "0612345678", "612345678",
 * "06 12 34 56 78", "+212612345678". All of those are the same number.
 *
 * Mobile ranges in Morocco start with 6 or 7 after the country code;
 * 5 is landline and cannot receive an SMS.
 */

export const COUNTRY_CODE = '212';
export const COUNTRY_PREFIX = `+${COUNTRY_CODE}`;

/** national significant number length, e.g. 612345678 */
const NATIONAL_DIGITS = 9;

const MOBILE_FIRST_DIGITS = ['6', '7'];

/**
 * Reduce anything the user typed or pasted to the national significant
 * number: digits only, no country code, no leading zero.
 *
 * Returns at most NATIONAL_DIGITS digits so the field cannot overflow.
 */
export function toNationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '');

  // "+212 6..." / "212 6..." — drop the country code
  if (digits.startsWith(COUNTRY_CODE)) {
    digits = digits.slice(COUNTRY_CODE.length);
  }

  // "06..." — drop the trunk prefix
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits.slice(0, NATIONAL_DIGITS);
}

/** Long enough to submit. Says nothing about whether it is a mobile. */
export function isComplete(nationalDigits: string): boolean {
  return nationalDigits.length === NATIONAL_DIGITS;
}

/**
 * A complete number that can actually receive an SMS.
 * Incomplete numbers are not "invalid" — the user is still typing.
 */
export function isValidMobile(nationalDigits: string): boolean {
  return (
    isComplete(nationalDigits) && MOBILE_FIRST_DIGITS.includes(nationalDigits.charAt(0))
  );
}

/**
 * E.164, the only form that goes near Supabase or the database.
 * Throws rather than send a malformed number to the SMS provider.
 */
export function toE164(nationalDigits: string): string {
  if (!isValidMobile(nationalDigits)) {
    throw new Error(`Not a valid Moroccan mobile number: ${nationalDigits}`);
  }
  return `${COUNTRY_PREFIX}${nationalDigits}`;
}

/**
 * Display grouping: 612345678 -> "612 345 678".
 * Latin digits, LTR — the caller renders it with the `numeric` style.
 */
export function formatNational(nationalDigits: string): string {
  return nationalDigits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}
