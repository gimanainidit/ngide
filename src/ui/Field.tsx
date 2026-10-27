import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { TOUCH } from '../theme/tokens';
import { T } from './Text';

const useStyles = makeStyles(({ c, fonts, radius }) => ({
  wrap: { gap: 6 },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: c.canvas,
    color: c.ink,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  focused: { borderWidth: 2, borderColor: c.primary, paddingHorizontal: 11 },
  multiline: { minHeight: 200, textAlignVertical: 'top', lineHeight: 24 },
  title: { fontFamily: fonts.sansSemibold, fontSize: 18 },
}));

export function Field({
  label,
  multiline,
  big,
  style,
  ...rest
}: TextInputProps & { label?: string; big?: boolean }) {
  const s = useStyles();
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.wrap}>
      {label ? <T variant="caption">{label}</T> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
        style={[s.input, multiline && s.multiline, big && s.title, focused && s.focused, style]}
      />
    </View>
  );
}
