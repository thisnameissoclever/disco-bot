import { describe, expect, it } from 'vitest';
import { periodWindow, isWithinHours, startOfUtcDay, startOfUtcWeek, daysAgo } from './time.js';

describe('periodWindow', () => {
  it('day starts at midnight UTC', () => {
    const w = periodWindow(new Date('2026-06-07T14:30:00Z'), 'day');
    expect(w.start.toISOString()).toBe('2026-06-07T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('week starts on Monday UTC', () => {
    const w = periodWindow(new Date('2026-06-07T14:30:00Z'), 'week');
    // 2026-06-07 is a Sunday; the week start is the prior Monday 2026-06-01.
    expect(w.start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('month starts at the 1st UTC', () => {
    const w = periodWindow(new Date('2026-06-15T14:30:00Z'), 'month');
    expect(w.start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('rolling window subtracts hours', () => {
    const now = new Date('2026-06-07T18:00:00Z');
    const w = periodWindow(now, 'rolling_n_hours', { rollingHours: 12 });
    expect(w.end.toISOString()).toBe('2026-06-07T18:00:00.000Z');
    expect(w.start.toISOString()).toBe('2026-06-07T06:00:00.000Z');
  });
});

describe('isWithinHours', () => {
  it('true when within the window', () => {
    const when = new Date('2026-06-07T18:00:00Z');
    const now = new Date('2026-06-07T18:30:00Z');
    expect(isWithinHours(when, now, 1)).toBe(true);
  });
  it('false when outside the window', () => {
    const when = new Date('2026-06-07T16:00:00Z');
    const now = new Date('2026-06-07T18:30:00Z');
    expect(isWithinHours(when, now, 1)).toBe(false);
  });
});

describe('startOfUtcDay / startOfUtcWeek / daysAgo', () => {
  it('daysAgo subtracts days', () => {
    const now = new Date('2026-06-07T00:00:00Z');
    const r = daysAgo(now, 7);
    expect(r.toISOString()).toBe('2026-05-31T00:00:00.000Z');
  });
  it('startOfUtcDay clears time', () => {
    expect(startOfUtcDay(new Date('2026-06-07T23:59:59Z')).toISOString())
      .toBe('2026-06-07T00:00:00.000Z');
  });
  it('startOfUtcWeek lands on Monday', () => {
    expect(startOfUtcWeek(new Date('2026-06-04T12:00:00Z')).toISOString())
      .toBe('2026-06-01T00:00:00.000Z');
  });
});
