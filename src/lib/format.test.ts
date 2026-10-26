import { describe, expect, it } from 'vitest';
import { formatDuration, snippet, timeAgo } from './format';

describe('formatDuration', () => {
  it('mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65_400)).toBe('01:05');
    expect(formatDuration(600_000)).toBe('10:00');
  });
});

describe('snippet', () => {
  it('memotong teks panjang', () => {
    expect(snippet('a'.repeat(200), 10)).toBe('aaaaaaaaaa…');
  });
  it('meratakan whitespace', () => {
    expect(snippet('a\n\n b')).toBe('a b');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-26T12:00:00Z').getTime();
  it('menit, jam, hari', () => {
    expect(timeAgo('2026-10-26T11:59:40Z', now)).toBe('baru saja');
    expect(timeAgo('2026-10-26T11:30:00Z', now)).toBe('30 menit lalu');
    expect(timeAgo('2026-10-26T09:00:00Z', now)).toBe('3 jam lalu');
    expect(timeAgo('2026-10-24T12:00:00Z', now)).toBe('2 hari lalu');
  });
});
