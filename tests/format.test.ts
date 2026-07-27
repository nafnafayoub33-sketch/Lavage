/**
 * tests/format.test.ts — src/lib/format.ts
 *
 * These return a key and its values, never a finished string — Arabic breaks
 * if a sentence is assembled by concatenation.
 */
import { formatDistance, formatWait } from '@/lib/format';

describe('formatDistance', () => {
  it('uses metres below a kilometre, rounded to 50', () => {
    expect(formatDistance(120)).toEqual({ key: 'wash.distanceM', params: { value: '100' } });
    expect(formatDistance(980)).toEqual({ key: 'wash.distanceM', params: { value: '1000' } });
  });

  it('uses kilometres with one decimal up to ten', () => {
    expect(formatDistance(1450)).toEqual({ key: 'wash.distanceKm', params: { value: '1.5' } });
    expect(formatDistance(9940)).toEqual({ key: 'wash.distanceKm', params: { value: '9.9' } });
  });

  it('drops the decimal from ten kilometres up', () => {
    expect(formatDistance(12_400)).toEqual({ key: 'wash.distanceKm', params: { value: '12' } });
  });

  it('never reports a negative distance', () => {
    expect(formatDistance(-5)).toEqual({ key: 'wash.distanceM', params: { value: '0' } });
  });
});

describe('formatWait', () => {
  it('uses minutes below an hour', () => {
    expect(formatWait(0)).toEqual({ key: 'wash.waitMinutes', params: { value: '0' } });
    expect(formatWait(59)).toEqual({ key: 'wash.waitMinutes', params: { value: '59' } });
  });

  it('uses whole hours when the minutes come out even', () => {
    expect(formatWait(120)).toEqual({ key: 'wash.waitHours', params: { value: '2' } });
  });

  it('splits hours and minutes into separate values to interpolate', () => {
    expect(formatWait(95)).toEqual({
      key: 'wash.waitHoursMinutes',
      params: { hours: '1', minutes: '35' },
    });
  });

  it('never reports a negative wait', () => {
    expect(formatWait(-10)).toEqual({ key: 'wash.waitMinutes', params: { value: '0' } });
  });
});
