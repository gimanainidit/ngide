import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { palettes } from './tokens';

describe('contrastRatio', () => {
  it('hitam/putih = 21, sama = 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#2c306d', '#2c306d')).toBeCloseTo(1, 5);
  });
  it('cocok dengan angka design system', () => {
    expect(contrastRatio('#ffffff', '#2c306d')).toBeCloseTo(12.0, 0);
    expect(contrastRatio('#046ee6', '#ffffff')).toBeCloseTo(4.8, 1);
  });
});

// Pasangan teks/latar yang benar-benar dipakai app. Semua wajib ≥ 4.5:1 (WCAG AA teks normal).
const TEXT_PAIRS: [fg: keyof (typeof palettes)['light'], bg: keyof (typeof palettes)['light']][] = [
  ['inkStrong', 'background'],
  ['inkStrong', 'canvas'],
  ['ink', 'canvas'],
  ['ink', 'background'],
  ['steel', 'canvas'],
  ['steel', 'background'],
  ['onPrimary', 'primary'],
  ['link', 'canvas'],
  ['inkStrong', 'accentSoft'],
  ['ink', 'accentSoft'],
  ['onDark', 'navy950'],
  ['onDarkMuted', 'navy950'],
  ['onDestructiveText', 'destructiveText'],
  ['dangerInk', 'canvas'],
];

describe.each(['light', 'dark'] as const)('palet %s', (scheme) => {
  for (const [fg, bg] of TEXT_PAIRS) {
    it(`${fg} di atas ${bg} ≥ 4.5:1`, () => {
      const p = palettes[scheme];
      expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('ikon besar (shield-blue di navy-950) ≥ 3:1', () => {
    const p = palettes[scheme];
    expect(contrastRatio(p.shieldBlue, p.navy950)).toBeGreaterThanOrEqual(3);
  });
});
