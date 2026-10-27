import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  deleteExcerpt,
  deletePrd,
  getMe,
  getPrd,
  listExcerpts,
  savePrd,
  standardizePrd,
  type Excerpt,
  type Prd,
} from '../../src/lib/api';
import { attributionLine, excerptChanged } from '../../src/lib/attribution';
import { sharePrdMarkdown } from '../../src/lib/exportPrd';

export default function PrdDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prd, setPrd] = useState<Prd | null>(null);
  const [excerpts, setExcerpts] = useState<Excerpt[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'ai' | 'export'>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, p, e] = await Promise.all([getMe(), getPrd(id), listExcerpts(id)]);
    setMeId(me.id);
    setPrd(p);
    setTitle(p.title);
    setBody(p.body_md);
    setExcerpts(e);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat PRD'));
  }, [load]);

  if (!prd) return <View style={s.center}>{error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator />}</View>;

  const dirty = title !== prd.title || body !== prd.body_md;

  async function run(kind: 'save' | 'ai' | 'export', action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      await savePrd(prd.id, { title: title.trim() || prd.title, body_md: body });
      await load();
    });

  // AI hanya membuat pratinjau; isi PRD baru berubah setelah user memilih "Pakai".
  const standardize = () =>
    run('ai', async () => {
      if (dirty) await savePrd(prd.id, { title: title.trim() || prd.title, body_md: body });
      setPreview(await standardizePrd(prd.id));
    });

  const applyPreview = () => {
    if (preview) setBody(preview);
    setPreview(null);
  };

  const exportMd = () =>
    run('export', async () => {
      await sharePrdMarkdown({ title: title.trim() || prd.title, body_md: body }, excerpts);
    });

  const removeExcerpt = (e: Excerpt) =>
    Alert.alert('Hapus kutipan ini dari PRD?', 'Ide sumbernya tidak ikut terhapus.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () =>
          run('save', async () => {
            await deleteExcerpt(e.id);
            await load();
          }),
      },
    ]);

  const removePrd = () =>
    Alert.alert(`Hapus PRD “${prd.title}”?`, 'Kutipan di dalamnya ikut terhapus. Ide sumber tetap ada.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () =>
          run('save', async () => {
            await deletePrd(prd.id);
            router.back();
          }),
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <TextInput style={s.titleInput} value={title} onChangeText={setTitle} placeholder="Judul PRD" />
        <TextInput
          style={s.bodyInput}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          placeholder="Tulis bebas dalam markdown. Nanti bisa disusun AI jadi PRD standar."
        />

        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.row}>
          {dirty && (
            <Pressable style={[s.btn, s.flex]} onPress={save} disabled={!!busy}>
              <Text style={s.btnText}>{busy === 'save' ? 'Menyimpan…' : 'Simpan'}</Text>
            </Pressable>
          )}
          <Pressable style={[s.btn, s.btnLight, s.flex]} onPress={standardize} disabled={!!busy}>
            <Text style={s.btnLightText}>{busy === 'ai' ? 'Menyusun…' : 'Susun jadi PRD standar (AI)'}</Text>
          </Pressable>
        </View>
        <Pressable style={[s.btn, s.btnLight]} onPress={exportMd} disabled={!!busy}>
          <Text style={s.btnLightText}>{busy === 'export' ? 'Menyiapkan…' : 'Export .md'}</Text>
        </Pressable>

        <Text style={s.section}>Ide terkait ({excerpts.length})</Text>
        {excerpts.length === 0 && (
          <Text style={s.empty}>Belum ada. Buka ide yang dibagikan → “Kutip ke PRD”.</Text>
        )}
        {excerpts.map((e) => {
          const changed = excerptChanged(e.idea_updated_at, e.idea?.updated_at ?? null);
          return (
            <View key={e.id} style={s.excerpt}>
              <Text style={s.quote}>{e.quote_md}</Text>
              <Text style={s.meta}>
                {e.idea ? `${e.idea.title} · ${attributionLine(e.idea)}` : 'Ide sumber sudah tidak tersedia'}
              </Text>
              {changed && <Text style={s.changed}>Sumber sudah diedit setelah dikutip</Text>}
              <View style={s.excerptActions}>
                {e.idea && (
                  <Pressable onPress={() => router.push(`/ide/${e.idea_id}`)}>
                    <Text style={s.link}>Buka ide</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => removeExcerpt(e)}>
                  <Text style={s.removeSmall}>Hapus kutipan</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {prd.created_by === meId && (
          <Pressable onPress={removePrd} disabled={!!busy}>
            <Text style={s.remove}>Hapus PRD</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={preview !== null} animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={s.modal}>
          <Text style={s.modalTitle}>Pratinjau PRD standar</Text>
          <Text style={s.meta}>Belum diterapkan. Isi PRD sekarang baru diganti kalau kamu pilih “Pakai”, dan tetap bisa diedit setelahnya.</Text>
          <ScrollView style={s.previewBox}>
            <Text style={s.previewText} selectable>
              {preview}
            </Text>
          </ScrollView>
          <View style={s.row}>
            <Pressable style={[s.btn, s.btnLight, s.flex]} onPress={() => setPreview(null)}>
              <Text style={s.btnLightText}>Batal</Text>
            </Pressable>
            <Pressable style={[s.btn, s.flex]} onPress={applyPreview}>
              <Text style={s.btnText}>Pakai</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  titleInput: { fontSize: 22, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#999', paddingVertical: 6 },
  bodyInput: { fontSize: 15, lineHeight: 22, minHeight: 260, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  btn: { backgroundColor: '#111', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnLight: { backgroundColor: '#eee' },
  btnLightText: { color: '#111', fontWeight: '600', textAlign: 'center' },
  section: { fontSize: 13, fontWeight: '700', opacity: 0.7, marginTop: 16 },
  empty: { opacity: 0.6 },
  excerpt: { borderLeftWidth: 3, borderColor: '#999', paddingLeft: 12, paddingVertical: 4, gap: 4 },
  quote: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  meta: { fontSize: 12, opacity: 0.65 },
  changed: { fontSize: 12, color: '#b45309', fontWeight: '600' },
  excerptActions: { flexDirection: 'row', gap: 16 },
  link: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  removeSmall: { color: '#c00', fontSize: 13 },
  remove: { color: '#c00', textAlign: 'center', padding: 12, marginTop: 8 },
  error: { color: '#c00' },
  modal: { flex: 1, padding: 16, paddingTop: 48, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  previewBox: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 12 },
  previewText: { fontSize: 14, lineHeight: 21 },
});
