import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { signInWithGoogle } from '../src/lib/auth';

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPress() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal masuk');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Ngide</Text>
      <Text style={s.tagline}>Ngomong aja, jadi catatan.</Text>
      <Pressable style={s.button} onPress={onPress} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Masuk dengan Google</Text>}
      </Pressable>
      {error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 40, fontWeight: '800' },
  tagline: { fontSize: 16, opacity: 0.7, marginBottom: 24 },
  button: { backgroundColor: '#111', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, minWidth: 240, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00', textAlign: 'center' },
});
