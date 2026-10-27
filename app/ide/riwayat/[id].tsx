import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getIdea, listRevisions, type Idea, type Revision } from '../../../src/lib/api';
import { personName } from '../../../src/lib/attribution';
import { timeAgo } from '../../../src/lib/format';

// Hanya baca: versi asli pemilik + setiap revisi setelah dibagikan.
export default function Riwayat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getIdea(id), listRevisions(id)])
      .then(([i, r]) => {
        setIdea(i);
        setRevisions(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat riwayat'));
  }, [id]);

  if (!idea || !revisions) {
    return <View style={s.center}>{error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator />}</View>;
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      {revisions.map((r, index) => (
        <View key={r.id} style={s.card}>
          <Text style={s.meta}>
            {index === 0 ? 'Versi terbaru · ' : ''}
            {personName(r.editor)} · {timeAgo(r.created_at)}
          </Text>
          <Text style={s.title}>{r.title}</Text>
          <Text style={s.body} selectable>
            {r.body_md}
          </Text>
        </View>
      ))}
      <View style={[s.card, s.original]}>
        <Text style={s.meta}>
          Versi asli · {personName(idea.author)}
          {idea.shared_at ? ` · dibagikan ${timeAgo(idea.shared_at)}` : ''}
        </Text>
        <Text style={s.title}>{idea.original_title ?? idea.title}</Text>
        <Text style={s.body} selectable>
          {idea.original_md ?? idea.body_md}
        </Text>
      </View>
      {revisions.length === 0 && <Text style={s.empty}>Belum ada yang mengedit ide ini sejak dibagikan.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 14, gap: 6 },
  original: { borderColor: '#111', borderWidth: 1.5 },
  meta: { fontSize: 12, opacity: 0.65 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  empty: { textAlign: 'center', opacity: 0.6 },
  error: { color: '#c00' },
});
