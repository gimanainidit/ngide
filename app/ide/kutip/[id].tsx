import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addExcerpts, createPrd, getIdea, listPrds, type Idea, type Prd } from '../../../src/lib/api';
import { splitParagraphs } from '../../../src/lib/attribution';

// Pilih paragraf dari ide yang dibagikan, lalu tempel ke PRD sebagai kutipan (snapshot).
export default function Kutip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [prds, setPrds] = useState<Prd[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getIdea(id), listPrds()])
      .then(([i, p]) => {
        setIdea(i);
        setPrds(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat'));
  }, [id]);

  if (!idea) return <View style={s.center}>{error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator />}</View>;
  if (idea.status !== 'shared') {
    return (
      <View style={s.center}>
        <Text>Bagikan ide ke tim dulu sebelum mengutipnya ke PRD.</Text>
      </View>
    );
  }

  const paragraphs = splitParagraphs(idea.body_md);
  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const canSave = picked.size > 0 && (target !== null || newTitle.trim().length > 0) && !busy;

  async function save() {
    if (!idea) return;
    setBusy(true);
    setError(null);
    try {
      const prdId = target ?? (await createPrd(newTitle));
      const quotes = [...picked].sort((a, b) => a - b).map((i) => paragraphs[i]);
      await addExcerpts(prdId, idea, quotes);
      router.replace(`/prd/${prdId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan kutipan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.section}>1. Pilih paragraf dari “{idea.title}”</Text>
      {paragraphs.map((p, i) => (
        <Pressable key={i} style={[s.para, picked.has(i) && s.paraPicked]} onPress={() => toggle(i)} accessibilityState={{ selected: picked.has(i) }}>
          <Text style={s.check}>{picked.has(i) ? '☑' : '☐'}</Text>
          <Text style={s.paraText}>{p}</Text>
        </Pressable>
      ))}

      <Text style={s.section}>2. Masukkan ke PRD</Text>
      {prds.map((p) => (
        <Pressable key={p.id} style={[s.option, target === p.id && s.optionPicked]} onPress={() => setTarget(p.id)}>
          <Text style={s.optionText}>
            {target === p.id ? '● ' : '○ '}
            {p.title}
          </Text>
        </Pressable>
      ))}
      <Pressable style={[s.option, target === null && s.optionPicked]} onPress={() => setTarget(null)}>
        <Text style={s.optionText}>{target === null ? '● ' : '○ '}PRD baru</Text>
        {target === null && (
          <TextInput style={s.input} value={newTitle} onChangeText={setNewTitle} placeholder="Nama produk / judul PRD" />
        )}
      </Pressable>

      {error && <Text style={s.error}>{error}</Text>}
      <Pressable style={[s.btn, !canSave && { opacity: 0.4 }]} onPress={save} disabled={!canSave}>
        <Text style={s.btnText}>
          {busy ? 'Menyimpan…' : picked.size ? `Kutip ${picked.size} paragraf` : 'Pilih paragraf dulu'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, gap: 10 },
  section: { fontSize: 13, fontWeight: '700', opacity: 0.7, marginTop: 8 },
  para: { flexDirection: 'row', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 10, padding: 12 },
  paraPicked: { borderColor: '#1d4ed8', borderWidth: 1.5, backgroundColor: '#eef6ff' },
  check: { fontSize: 18 },
  paraText: { flex: 1, fontSize: 15, lineHeight: 22 },
  option: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 10, padding: 12, gap: 8 },
  optionPicked: { borderColor: '#111', borderWidth: 1.5 },
  optionText: { fontSize: 15, fontWeight: '600' },
  input: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#999', paddingVertical: 6, fontSize: 15 },
  btn: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#c00' },
});
