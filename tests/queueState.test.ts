/**
 * tests/queueState.test.ts — src/core/usecases/queueState.ts
 *
 * The thresholds behind C1's green / amber / red dot.
 */
import {
  BUSY_FROM_MINUTES,
  FULL_FROM_MINUTES,
  queueStateFor,
} from '@/core/usecases/queueState';

const open = (waitMinutes: number) => queueStateFor({ waitMinutes, isOpen: true });

describe('an open car wash', () => {
  it('is free below fifteen minutes', () => {
    expect(open(0)).toBe('free');
    expect(open(BUSY_FROM_MINUTES - 1)).toBe('free');
  });

  it('is busy from fifteen to forty', () => {
    expect(open(BUSY_FROM_MINUTES)).toBe('busy');
    expect(open(30)).toBe('busy');
    expect(open(FULL_FROM_MINUTES)).toBe('busy');
  });

  it('is full past forty', () => {
    expect(open(FULL_FROM_MINUTES + 1)).toBe('full');
    expect(open(180)).toBe('full');
  });
});

describe('a closed car wash', () => {
  it('is full however short its queue', () => {
    // You cannot join it, so an empty queue is not an invitation.
    expect(queueStateFor({ waitMinutes: 0, isOpen: false })).toBe('full');
    expect(queueStateFor({ waitMinutes: 120, isOpen: false })).toBe('full');
  });
});
