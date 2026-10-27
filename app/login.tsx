import { useState } from 'react';
import { View } from 'react-native';
import { signInWithGoogle } from '../src/lib/auth';
import { makeStyles } from '../src/theme/ThemeContext';
import { Button } from '../src/ui/Button';
import { ErrorText } from '../src/ui/Screen';
import { ShieldStripe } from '../src/ui/ShieldStripe';
import { T } from '../src/ui/Text';

export default function Login() {
  const s = useStyles();
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
    <View style={s.root}>
      <View style={s.body}>
        <T variant="eyebrow" style={s.onDarkMuted}>Catatan ide tim</T>
        <T variant="display" style={s.title}>Ngide</T>
        <T variant="body" style={s.onDarkMuted}>Ngomong aja, jadi catatan.</T>
        <Button label="Masuk dengan Google" variant="primary" onPress={onPress} busy={busy} style={s.button} />
        {error && <ErrorText>{error}</ErrorText>}
        <T variant="caption" style={s.onDarkMuted}>Hanya untuk anggota tim yang terdaftar.</T>
      </View>
      <ShieldStripe height={12} />
    </View>
  );
}

const useStyles = makeStyles(({ c, space }) => ({
  root: { flex: 1, backgroundColor: c.navy950 },
  body: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.sm },
  title: { color: c.onDark, fontSize: 56, lineHeight: 60 },
  onDarkMuted: { color: c.onDarkMuted },
  // Di dasar navy, CTA memakai biru perisai agar kontras di kedua tema.
  button: { backgroundColor: c.shieldBlue, marginTop: space.md, alignSelf: 'stretch' },
}));
