// Token Ngide, turunan design system Triad PRO-TX × Eranusasiber v1.2 (lihat Color Mood).
// Pure: aman diimpor dari tes.

const brand = {
  navy950: '#021222',
  navy900: '#0b1830',
  shieldBlue: '#0096fa',
  onDark: '#ffffff',
  onDarkMuted: '#9ba0ab',
};

export const palettes = {
  light: {
    ...brand,
    background: '#f6f7f9',
    canvas: '#ffffff',
    surfaceRaised: '#f6f7f9',
    hairline: '#e2e5e9',
    hairlineStrong: '#c4cad3',
    inkStrong: '#021222',
    ink: '#2b3746',
    steel: '#6b7280',
    muted: '#9ba0ab',
    primary: '#2c306d',
    primaryDeep: '#22265a',
    onPrimary: '#ffffff',
    link: '#046ee6',
    accent: '#1876c3',
    accentSoft: '#e6f3fe',
    accentSoftBorder: '#bfdcf7',
    ring: '#218ce4',
    // Merah hanya untuk status merekam (isian/ikon ≥24px). Teks merah memakai dangerInk.
    destructive: '#ef4444',
    destructiveText: '#b91c1c',
    onDestructiveText: '#ffffff',
    dangerInk: '#b91c1c',
  },
  dark: {
    ...brand,
    background: '#0f1729',
    canvas: '#131d34',
    surfaceRaised: '#182543',
    hairline: '#1b294b',
    hairlineStrong: '#2a3a5e',
    inkStrong: '#ffffff',
    ink: '#f6f7f9',
    steel: '#9ba0ab',
    muted: '#6b7280',
    primary: '#0096fa',
    primaryDeep: '#5aa9f5',
    onPrimary: '#0f1729',
    link: '#5aa9f5',
    accent: '#218ce4',
    accentSoft: '#12294a',
    accentSoftBorder: '#1f3d66',
    ring: '#218ce4',
    destructive: '#ef4444',
    destructiveText: '#7f1d1d',
    onDestructiveText: '#f6f7f9',
    dangerInk: '#fca5a5',
  },
};

export type Palette = (typeof palettes)['light'];
export type Scheme = keyof typeof palettes;

export const fonts = {
  serif: 'DMSerifDisplay_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
};

export const radius = { sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 9999 };
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };

// Target sentuh minimum Android (48dp), sesuai pedoman ui-ux-pro-max.
export const TOUCH = 48;

export const shieldStripe = ['#021222', '#2c306d', '#046ee6', '#0096fa', '#e6f3fe'];
