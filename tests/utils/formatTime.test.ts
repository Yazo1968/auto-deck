import { describe, it, expect } from 'vitest';
import { formatTimestampFull } from '../../utils/formatTime';

describe('formatTimestampFull', () => {
  it('returns em-dash for undefined input', () => {
    expect(formatTimestampFull(undefined)).toBe('—');
  });

  it('returns em-dash for 0', () => {
    expect(formatTimestampFull(0)).toBe('—');
  });

  it('formats a known timestamp correctly', () => {
    // 3 Jan 2026 18:12:00 local time
    const d = new Date(2026, 0, 3, 18, 12, 0);
    const result = formatTimestampFull(d.getTime());
    expect(result).toBe('03 Jan 2026 6:12 PM');
  });

  it('formats midnight correctly (12:00 AM)', () => {
    const d = new Date(2025, 5, 15, 0, 5, 0); // Jun 15 2025 00:05
    const result = formatTimestampFull(d.getTime());
    expect(result).toBe('15 Jun 2025 12:05 AM');
  });

  it('formats noon correctly (12:00 PM)', () => {
    const d = new Date(2025, 11, 25, 12, 0, 0); // Dec 25 2025 12:00
    const result = formatTimestampFull(d.getTime());
    expect(result).toBe('25 Dec 2025 12:00 PM');
  });

  it('zero-pads single-digit day and minutes', () => {
    const d = new Date(2026, 2, 5, 9, 3, 0); // Mar 5 2026 9:03
    const result = formatTimestampFull(d.getTime());
    expect(result).toBe('05 Mar 2026 9:03 AM');
  });
});
