import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { TOUCH } from '../theme/tokens';

type Variant = 'primary' | 'soft' | 'secondary' | 'link' | 'danger';

const useStyles = makeStyles(({ c, fonts, radius }) => ({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.lg, // tombol 8px, tidak berbentuk pil
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: c.primary },
  soft: { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentSoftBorder },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.hairlineStrong },
  link: { backgroundColor: 'transparent', paddingHorizontal: 8, alignSelf: 'flex-start' },
  danger: { backgroundColor: 'transparent', paddingHorizontal: 8, alignSelf: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, textAlign: 'center' },
}));

export function Button({
  label,
  variant = 'secondary',
  icon: Icon,
  busy,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  icon?: LucideIcon;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const { c } = useTheme();
  const color = { primary: c.onPrimary, soft: c.inkStrong, secondary: c.inkStrong, link: c.link, danger: c.dangerInk }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      hitSlop={variant === 'link' || variant === 'danger' ? 8 : undefined}
      style={({ pressed }) => [s.base, s[variant], pressed && s.pressed, (disabled || busy) && s.disabled, style]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={color} /> : Icon ? <Icon size={18} color={color} strokeWidth={2} /> : null}
      <View>
        <Text style={[s.label, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}
