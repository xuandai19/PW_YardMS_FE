import { describe, expect, it } from 'vitest';
import { formatYardDuration } from './operations';

describe('formatYardDuration', () => {
  it('formats hours and remaining minutes', () => {
    expect(formatYardDuration(3 * 60 * 60 + 17 * 60)).toBe('3 giờ 17 phút');
  });

  it('handles less than one minute', () => {
    expect(formatYardDuration(59)).toBe('0 giờ 0 phút');
  });
});
