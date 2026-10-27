import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { completeSignIn } from '../src/lib/auth';
import { makeStyles, useTheme } from '../src/theme/ThemeContext';
import { palettes } from '../src/theme/tokens';
import { Button } from '../src/ui/Button';
import { T } from '../src/ui/Text';

// Tujuan deep link ngide://auth-callback?code=... setelah login Google.
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const s = useStyles();
  const { c } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    // Sukses: onAuthStateChange memicu gerbang di _layout untuk pindah ke beranda.
    completeSignIn(url).catch((e) => setError(e instanceof Error ? e.message : 'Gagal masuk'));
  }, [url]);

  return (
    <View style={s.root}>
      {error ? (
        <>
          <T variant="small" style={{ color: palettes.dark.dangerInk, textAlign: 'center' }} accessibilityLiveRegion="polite">
            {error}
          </T>
          <Button label="Kembali" variant="soft" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={c.shieldBlue} />
          <T variant="small" style={{ color: c.onDarkMuted }}>Menyelesaikan login…</T>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ c, space }) => ({
  root: { flex: 1, backgroundColor: c.navy950, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md },
}));
