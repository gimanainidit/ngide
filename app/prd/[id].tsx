import { router, useLocalSearchParams } from 'expo-router';
import { Download, ExternalLink, Sparkles, Trash2 } from '../../src/ui/icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, View } from 'react-native';
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
import { makeStyles } from '../../src/theme/ThemeContext';
import { Badge } from '../../src/ui/Badge';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { CenterState, ErrorText, Screen } from '../../src/ui/Screen';
import { ShieldStripe } from '../../src/ui/ShieldStripe';
import { T } from '../../src/ui/Text';

export default function PrdDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const [prd, setPrd] = useState<Prd | null>(null);
  const [excerpts, setExcerpts] = useState<Excerpt[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'ai' | 'export'>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(([me, p, e]: [{ id: string }, Prd, Excerpt[]]) => {
    setMeId(me.id);
    setPrd(p);
    setTitle(p.title);
    setBody(p.body_md);
    setExcerpts(e);
  }, []);

  const load = useCallback(async () => {
    apply(await Promise.all([getMe(), getPrd(id), listExcerpts(id)]));
  }, [id, apply]);

  useEffect(() => {
    Promise.all([getMe(), getPrd(id), listExcerpts(id)])
      .then(apply)
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat PRD'));
  }, [id, apply]);

  if (!prd) return <CenterState error={error} />;

  const dirty = title !== prd.title || body !== prd.body_md;
  const fields = () => ({ title: title.trim() || prd.title, body_md: body });

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
      await savePrd(prd.id, fields());
      await load();
    });

  // AI hanya membuat pratinjau; isi PRD baru berubah setelah user memilih "Pakai".
  const standardize = () =>
    run('ai', async () => {
      if (dirty) await savePrd(prd.id, fields());
      setPreview(await standardizePrd(prd.id));
    });

  const applyPreview = () => {
    if (preview) setBody(preview);
    setPreview(null);
  };

  const exportMd = () => run('export', () => sharePrdMarkdown(fields(), excerpts));

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
    <Screen>
      <Field label="Judul PRD" value={title} onChangeText={setTitle} big />
      <Field
        label="Isi (markdown bebas)"
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Tulis bebas. Nanti bisa disusun AI jadi PRD standar."
      />

      {error && <ErrorText>{error}</ErrorText>}
      {dirty && <Button label="Simpan" variant="primary" onPress={save} busy={busy === 'save'} disabled={!!busy} />}
      <Button label="Susun jadi PRD standar (AI)" variant="soft" icon={Sparkles} onPress={standardize} busy={busy === 'ai'} disabled={!!busy} />
      <Button label="Export .md" icon={Download} onPress={exportMd} busy={busy === 'export'} disabled={!!busy} />

      <T variant="eyebrow" style={{ marginTop: 16 }}>Ide terkait ({excerpts.length})</T>
      {excerpts.length === 0 && <T variant="small">Belum ada. Buka ide yang dibagikan → “Kutip ke PRD”.</T>}
      {excerpts.map((e) => {
        const changed = excerptChanged(e.idea_updated_at, e.idea?.updated_at ?? null);
        return (
          <View key={e.id} style={s.excerpt}>
            <T variant="small" style={s.quote}>{e.quote_md}</T>
            <T variant="caption">{e.idea ? `${e.idea.title} · ${attributionLine(e.idea)}` : 'Ide sumber sudah tidak tersedia'}</T>
            {changed && <Badge kind="changed" label="Sumber sudah diedit setelah dikutip" />}
            <View style={s.row}>
              {e.idea && <Button label="Buka ide" variant="link" icon={ExternalLink} onPress={() => router.push(`/ide/${e.idea_id}`)} />}
              <Button label="Hapus kutipan" variant="danger" onPress={() => removeExcerpt(e)} />
            </View>
          </View>
        );
      })}

      {prd.created_by === meId && <Button label="Hapus PRD" variant="danger" icon={Trash2} onPress={removePrd} disabled={!!busy} style={{ marginTop: 16 }} />}

      <Modal visible={preview !== null} animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={s.modal}>
          <T variant="title">Pratinjau PRD standar</T>
          <T variant="caption">Belum diterapkan. Isi PRD baru diganti kalau kamu pilih “Pakai”, dan tetap bisa diedit setelahnya.</T>
          <ScrollView style={s.previewBox} contentContainerStyle={{ padding: 12 }}>
            <T variant="small" selectable>{preview}</T>
          </ScrollView>
          <View style={s.row}>
            <Button label="Batal" onPress={() => setPreview(null)} style={{ flex: 1 }} />
            <Button label="Pakai" variant="primary" onPress={applyPreview} style={{ flex: 1 }} />
          </View>
        </View>
        <ShieldStripe />
      </Modal>
    </Screen>
  );
}

const useStyles = makeStyles(({ c, radius, space }) => ({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  excerpt: { borderLeftWidth: 3, borderColor: c.hairlineStrong, paddingLeft: space.sm, paddingVertical: 4, gap: 6 },
  quote: { fontStyle: 'italic' },
  modal: { flex: 1, backgroundColor: c.background, padding: space.md, paddingTop: 48, gap: space.sm },
  previewBox: { flex: 1, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.xl, backgroundColor: c.canvas },
}));
