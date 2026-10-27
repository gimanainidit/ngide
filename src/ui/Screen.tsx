import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { T } from './Text';

const useStyles = makeStyles(({ c, space }) => ({
  root: { flex: 1, backgroundColor: c.background },
  content: { padding: space.md, gap: space.sm, paddingBottom: space.xxl },
  center: { flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
}));

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const s = useStyles();
  if (!scroll) return <View style={[s.root, s.content]}>{children}</View>;
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Loading atau pesan error di tengah layar (pedoman: jangan layar kosong saat memuat).
export function CenterState({ error, children }: { error?: string | null; children?: ReactNode }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View style={s.center}>
      {error ? <T variant="small" style={{ color: c.dangerInk, textAlign: 'center' }}>{error}</T> : children ?? <ActivityIndicator color={c.primary} />}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <T variant="small" style={{ color: c.dangerInk }} accessibilityLiveRegion="polite">
      {children}
    </T>
  );
}
