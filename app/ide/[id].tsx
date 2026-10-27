import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { History, Pause, Play, Quote, RefreshCw, Send, Sparkles, Trash2 } from '../../src/ui/icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import {
  acceptSuggestion,
  deleteDraft,
  dismissSuggestion,
  EditConflictError,
  getAudioUrl,
  getIdea,
  getMe,
  saveIdea,
  shareIdea,
  type Idea,
} from '../../src/lib/api';
import { editedLabel } from '../../src/lib/attribution';
import { formatDuration } from '../../src/lib/format';
import { getItem } from '../../src/lib/queueStore';
import { makeStyles, useTheme } from '../../src/theme/ThemeContext';
import { TOUCH } from '../../src/theme/tokens';
import { Badge } from '../../src/ui/Badge';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Field } from '../../src/ui/Field';
import { CenterState, ErrorText, Screen } from '../../src/ui/Screen';
import { T } from '../../src/ui/Text';

export default function IdeaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { c } = useTheme();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [me, loaded] = await Promise.all([getMe(), getIdea(id)]);
        setMeId(me.id);
        setIdea(loaded);
        setTitle(loaded.title);
        setBody(loaded.body_md);
        if (loaded.recording_id && loaded.author_id === me.id) {
          // Mode Selalu lokal: audio tidak ada di server, hanya di HP ini.
          const source = (await getAudioUrl(loaded.recording_id)) ?? (await getItem(loaded.recording_id))?.uri;
          if (source) {
            player.replace(source);
            setAudioReady(true);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat ide');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!idea) return <CenterState error={error} />;

  const isAuthor = idea.author_id === meId;
  const isDraft = idea.status === 'draft';
  // Draft: hanya pembuat. Setelah dibagikan: seluruh tim (riwayat mencatat setiap perubahan).
  const editable = isAuthor || idea.status === 'shared';
  const dirty = title !== idea.title || body !== idea.body_md;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      await action();
    } catch (e) {
      setConflict(e instanceof EditConflictError);
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setBusy(false);
    }
  }

  const fields = () => ({ title: title.trim() || idea.title, body_md: body });

  const save = () =>
    run(async () => {
      await saveIdea(idea.id, fields(), idea.updated_at);
      setIdea(await getIdea(idea.id));
    });

  // Ambil versi terbaru dari server; editan yang belum tersimpan dibuang.
  const reload = () =>
    run(async () => {
      const fresh = await getIdea(idea.id);
      setIdea(fresh);
      setTitle(fresh.title);
      setBody(fresh.body_md);
    });

  const share = () =>
    Alert.alert('Bagikan ke tim?', 'Seluruh anggota tim akan bisa membaca dan mengedit ide ini. Audio tetap privat.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Bagikan',
        onPress: () =>
          run(async () => {
            if (dirty) await saveIdea(idea.id, fields(), idea.updated_at);
            await shareIdea(idea.id);
            setIdea(await getIdea(idea.id));
          }),
      },
    ]);

  const applySuggestion = () =>
    run(async () => {
      await acceptSuggestion(idea);
      const fresh = await getIdea(idea.id);
      setIdea(fresh);
      setTitle(fresh.title);
      setBody(fresh.body_md);
    });

  const ignoreSuggestion = () =>
    run(async () => {
      await dismissSuggestion(idea.id);
      setIdea(await getIdea(idea.id));
    });

  const remove = () =>
    Alert.alert('Hapus draft?', 'Draft ini akan dihapus. Rekaman audio tetap tersimpan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteDraft(idea.id);
            router.back();
          }),
      },
    ]);

  return (
    <Screen>
      <View style={s.metaRow}>
        <Badge kind={isDraft ? 'draft' : 'shared'} label={isDraft ? 'Draft' : 'Dibagikan'} />
        <T variant="caption" style={{ flex: 1 }}>
          {isDraft ? 'Privat — hanya kamu yang melihat' : editedLabel(idea as Parameters<typeof editedLabel>[0])}
        </T>
      </View>

      {idea.suggested_body_md && editable && (
        <Card tone="soft">
          <View style={s.metaRow}>
            <Sparkles size={16} color={c.link} strokeWidth={2} />
            <T variant="caption" style={{ color: c.inkStrong, fontFamily: 'Inter_600SemiBold' }}>Versi rapi tersedia</T>
          </View>
          {idea.suggested_title && <T variant="heading">{idea.suggested_title}</T>}
          <T variant="small" numberOfLines={8}>{idea.suggested_body_md}</T>
          <View style={s.row}>
            <Button label="Pakai versi rapi" variant={isDraft ? 'soft' : 'primary'} onPress={applySuggestion} disabled={busy} />
            <Button label="Abaikan" variant="link" onPress={ignoreSuggestion} disabled={busy} />
          </View>
        </Card>
      )}

      {editable ? (
        <Field label="Judul" value={title} onChangeText={setTitle} big />
      ) : (
        <T variant="title">{idea.title}</T>
      )}

      {audioReady && (
        <View style={s.player}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Jeda rekaman' : 'Putar rekaman'}
            onPress={() => (status.playing ? player.pause() : player.play())}
            style={s.playBtn}
          >
            {status.playing ? <Pause size={20} color={c.inkStrong} /> : <Play size={20} color={c.inkStrong} />}
          </Pressable>
          <View style={s.track}>
            <View style={[s.trackFill, { width: `${status.duration ? Math.min(100, (status.currentTime / status.duration) * 100) : 0}%` }]} />
          </View>
          <T variant="caption">
            {formatDuration(status.currentTime * 1000)} / {formatDuration(status.duration * 1000)}
          </T>
        </View>
      )}

      {editable ? (
        <Field label="Isi (markdown)" value={body} onChangeText={setBody} multiline placeholder="Isi catatan" />
      ) : (
        <T variant="body" selectable>{idea.body_md}</T>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {conflict && <Button label="Muat ulang versi terbaru" icon={RefreshCw} onPress={reload} disabled={busy} />}

      {idea.status === 'shared' && (
        <View style={s.row}>
          <Button label="Kutip ke PRD" variant="link" icon={Quote} onPress={() => router.push(`/ide/kutip/${idea.id}`)} />
          <Button label="Riwayat" variant="link" icon={History} onPress={() => router.push(`/ide/riwayat/${idea.id}`)} />
        </View>
      )}

      {editable && (
        <View style={s.actions}>
          {dirty && <Button label="Simpan" onPress={save} busy={busy && !isDraft} disabled={busy} />}
          {isDraft && <Button label="Bagikan ke tim" variant="primary" icon={Send} onPress={share} disabled={busy} />}
          {isDraft && <Button label="Hapus draft" variant="danger" icon={Trash2} onPress={remove} disabled={busy} />}
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ c, radius, space }) => ({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  playBtn: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
    backgroundColor: c.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.hairline, overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: c.link },
  actions: { gap: space.sm, marginTop: space.xs },
}));
