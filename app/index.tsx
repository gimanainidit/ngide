import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../src/lib/supabase';

type Me = { name: string; team: string } | null;

export default function Home() {
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const id = user.user?.id;
      if (!id) return;
      const [{ data: profile }, { data: team }] = await Promise.all([
        supabase.from('profiles').select('display_name,email').eq('id', id).single(),
        supabase.from('teams').select('name').limit(1).maybeSingle(),
      ]);
      setMe({ name: profile?.display_name ?? profile?.email ?? 'kamu', team: team?.name ?? '-' });
    })();
  }, []);

  return (
    <View style={s.container}>
      <Text style={s.hello}>Halo {me?.name ?? '...'}</Text>
      <Text style={s.team}>Tim {me?.team ?? '...'}</Text>
      <Pressable onPress={() => supabase.auth.signOut()} style={s.out}>
        <Text>Keluar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  hello: { fontSize: 28, fontWeight: '700' },
  team: { fontSize: 16, opacity: 0.7 },
  out: { marginTop: 24, padding: 12 },
});
