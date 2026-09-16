import { describe, expect, it, vi } from 'vitest';
import { formatDeadline, getDaysLeft, isPollPast } from './poll.model';

describe('poll date helpers', () => {
  it('calculates calendar days without counting the remaining hours of today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 18, 30));

    expect(getDaysLeft('2026-09-17')).toBe(1);
    expect(getDaysLeft('2026-09-18')).toBe(2);
    expect(getDaysLeft('2026-09-19')).toBe(3);

    vi.useRealTimers();
  });

  it('recognizes past deadlines and formats database dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 18, 30));

    expect(isPollPast('2026-09-15')).toBe(true);
    expect(isPollPast('2026-09-16')).toBe(false);
    expect(formatDeadline('2026-09-17')).toBe('17.9.2026');

    vi.useRealTimers();
  });
});
