import { Pressable, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';

const useStyles = makeStyles(({ c, radius, space }) => ({
  card: { backgroundColor: c.canvas, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.xl, padding: space.md, gap: 6 },
  soft: { backgroundColor: c.accentSoft, borderColor: c.accentSoftBorder },
  dashed: { borderStyle: 'dashed', borderColor: c.hairlineStrong },
  pressed: { opacity: 0.85 },
}));

type Tone = 'default' | 'soft' | 'dashed';

export function Card({ tone = 'default', style, ...rest }: ViewProps & { tone?: Tone }) {
  const s = useStyles();
  return <View {...rest} style={[s.card, tone === 'soft' && s.soft, tone === 'dashed' && s.dashed, style]} />;
}

export function PressableCard({
  tone = 'default',
  style,
  ...rest
}: Omit<PressableProps, 'style'> & { tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [s.card, tone === 'soft' && s.soft, tone === 'dashed' && s.dashed, pressed && s.pressed, style]}
    />
  );
}
