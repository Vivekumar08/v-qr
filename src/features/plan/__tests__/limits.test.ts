import { describe, expect, it } from 'vitest';
import { isLimitReached, meterFill } from '../limits';

/**
 * These two functions are the entire console-side notion of "is this plan
 * ceiling reached". Task 9 exists specifically to catch this before a form
 * submit, so the boundary (`used === limit`) and the unlimited case (`null`)
 * are the two ways to get it wrong silently.
 */
describe('isLimitReached', () => {
  it('is false with room to spare', () => {
    expect(isLimitReached(9, 10)).toBe(false);
  });

  it('is true exactly at the ceiling — the eleventh code is the one that fails', () => {
    expect(isLimitReached(10, 10)).toBe(true);
  });

  it('is true past the ceiling, the state a plan downgrade leaves behind', () => {
    expect(isLimitReached(12, 10)).toBe(true);
  });

  it('is never true for an unlimited plan', () => {
    expect(isLimitReached(0, null)).toBe(false);
    expect(isLimitReached(1_000_000, null)).toBe(false);
  });
});

describe('meterFill', () => {
  it('draws no bar for an unlimited ceiling', () => {
    expect(meterFill(3, null)).toEqual({ show: false, percent: 0, over: false });
  });

  it('reports the plain percentage under the ceiling', () => {
    expect(meterFill(3, 10)).toEqual({ show: true, percent: 30, over: false });
  });

  it('clamps at 100 rather than overflowing when a downgrade leaves usage over the ceiling', () => {
    const fill = meterFill(15, 10);
    expect(fill.show).toBe(true);
    expect(fill.percent).toBe(100);
    expect(fill.over).toBe(true);
  });

  it('marks over exactly at the ceiling, matching isLimitReached', () => {
    const fill = meterFill(10, 10);
    expect(fill.percent).toBe(100);
    expect(fill.over).toBe(true);
  });
});
