/**
 * src/lib/format.ts
 *
 * Formatters that hand back an i18n key and its values rather than a
 * finished string.
 *
 * Never build a sentence by concatenation — Arabic breaks around the digits.
 * The caller interpolates:
 *
 *   const { key, params } = formatDistance(1450);
 *   t(key, params)              // "1,5 كم"
 *
 * Money is not here: formatDH() lives in i18n.ts alongside the language it
 * needs.
 */

export type Formatted = {
  key: string;
  params: Record<string, string>;
};

/**
 * Distance to a car wash. Metres while they mean something to a person on
 * foot, kilometres beyond that, one decimal at most — nobody needs 1.47 km.
 */
export function formatDistance(metres: number): Formatted {
  if (metres < 1000) {
    // Rounded to 50m: a phone's GPS fix does not justify more precision.
    const rounded = Math.max(0, Math.round(metres / 50) * 50);
    return { key: 'wash.distanceM', params: { value: String(rounded) } };
  }

  const km = metres / 1000;
  // 10 km and up reads better whole.
  const value = km >= 10 ? String(Math.round(km)) : String(Math.round(km * 10) / 10);
  return { key: 'wash.distanceKm', params: { value } };
}

/**
 * Estimated wait. Minutes up to an hour, then hours — "95 minutes" is a
 * number to decode, "1h 35" is a glance.
 */
export function formatWait(minutes: number): Formatted {
  const total = Math.max(0, Math.round(minutes));

  if (total < 60) {
    return { key: 'wash.waitMinutes', params: { value: String(total) } };
  }

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (rest === 0) {
    return { key: 'wash.waitHours', params: { value: String(hours) } };
  }

  return {
    key: 'wash.waitHoursMinutes',
    params: { hours: String(hours), minutes: String(rest) },
  };
}
