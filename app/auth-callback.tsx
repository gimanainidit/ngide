import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { completeSignIn } from '../src/lib/auth';

// Tujuan deep link ngide://auth-callback?code=... setelah login Google.
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    // Sukses: onAuthStateChange memicu gerbang di _layout untuk pindah ke beranda.
    completeSignIn(url).catch((e) => setError(e instanceof Error ? e.message : 'Gagal masuk'));
  }, [url]);

  return (
    <View style={s.container}>
      {error ? (
        <>
          <Text style={s.error}>{error}</Text>
          <Pressable style={s.button} onPress={() => router.replace('/login')}>
            <Text style={s.buttonText}>Kembali</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text style={s.hint}>Menyelesaikan login…</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  hint: { opacity: 0.7 },
  error: { color: '#c00', textAlign: 'center' },
  button: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
