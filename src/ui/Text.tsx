import { Text, type TextProps } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';

export type TextVariant = 'display' | 'stat' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'eyebrow' | 'mono';

const useStyles = makeStyles(({ c, fonts }) => ({
  // DM Serif Display hanya ≥ 36px (aturan design system).
  display: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 41, letterSpacing: -0.5, color: c.inkStrong },
  stat: { fontFamily: fonts.serif, fontSize: 80, lineHeight: 84, letterSpacing: -1, color: c.inkStrong, fontVariant: ['tabular-nums'] },
  title: { fontFamily: fonts.sansMedium, fontSize: 22, lineHeight: 29, color: c.inkStrong },
  heading: { fontFamily: fonts.sansSemibold, fontSize: 16, lineHeight: 22, color: c.inkStrong },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 25, color: c.ink },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 25, color: c.inkStrong },
  small: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: c.ink },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: c.steel },
  eyebrow: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 1, color: c.steel, textTransform: 'uppercase' },
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 21, color: c.ink },
}));

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: TextVariant }) {
  const s = useStyles();
  return <Text {...rest} style={[s[variant], style]} />;
}
