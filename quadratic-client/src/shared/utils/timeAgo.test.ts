import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeAgoAndNextTimeout } from './timeAgo';

describe('timeAgoAndNextTimeout', () => {
  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "< 1m ago" for times less than a minute ago', () => {
    const now = Date.now();
    const thirtySecondsAgo = now - 30 * 1000;
    const result = timeAgoAndNextTimeout(thirtySecondsAgo);
    expect(result.timeAgo).toBe('< 1m ago');
    // Should update at the next minute (12:00:00)
    expect(result.nextInterval).toBe(30001);
  });

  it('should return minutes for times less than an hour ago', () => {
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    const result = timeAgoAndNextTimeout(thirtyMinutesAgo);
    expect(result.timeAgo).toBe('30m ago');
    expect(result.nextInterval).toBe(60 * 1000 + 1); // Next update in 1 minute
  });

  it('should return hours for times less than a day ago', () => {
    const threeHoursAgo = new Date().getTime() - 3 * 60 * 60 * 1000;
    const result = timeAgoAndNextTimeout(threeHoursAgo);
    expect(result.timeAgo).toBe('3h ago');
    expect(result.nextInterval).toBe(60 * 60 * 1000 + 1);
  });

  it('should return date for times less than a week ago', () => {
    const fourDaysAgo = new Date().getTime() - 4 * 24 * 60 * 60 * 1000;
    const result = timeAgoAndNextTimeout(fourDaysAgo);
    expect(result.timeAgo).toBe('Dec 28, 2023');
    expect(result.nextInterval).toBe(-1);
  });

  it('should return formatted date for times more than 24 hours ago', () => {
    const sevenDaysAgo = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
    const result = timeAgoAndNextTimeout(sevenDaysAgo);
    expect(result.timeAgo).toBe('Dec 25, 2023');
    expect(result.nextInterval).toBe(-1); // No next interval for formatted date
  });
});
