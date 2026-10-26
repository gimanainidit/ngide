import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  authorName,
  deleteDraft,
  getAudioUrl,
  getIdea,
  getMe,
  saveIdea,
  shareIdea,
  type Idea,
} from '../../src/lib/api';
import { formatDuration } from '../../src/lib/format';

export default function IdeaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          player.replace(await getAudioUrl(loaded.recording_id));
          setAudioReady(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat ide');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!idea) {
    return (
      <View style={s.center}>
        {error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const isAuthor = idea.author_id === meId;
  const isDraft = idea.status === 'draft';
  const editable = isAuthor;
  const dirty = title !== idea.title || body !== idea.body_md;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await saveIdea(idea.id, { title: title.trim() || idea.title, body_md: body });
      setIdea(await getIdea(idea.id));
    });

  const share = () =>
    Alert.alert('Bagikan ke tim?', 'Seluruh anggota tim akan bisa membaca ide ini. Audio tetap privat.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Bagikan',
        onPress: () =>
          run(async () => {
            if (dirty) await saveIdea(idea.id, { title: title.trim() || idea.title, body_md: body });
            await shareIdea(idea.id);
            setIdea(await getIdea(idea.id));
          }),
      },
    ]);

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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.meta}>
          {isDraft ? 'Draft privat — hanya kamu yang melihat' : `Dibagikan · ${authorName(idea)}`}
        </Text>

        {editable ? (
          <TextInput style={s.titleInput} value={title} onChangeText={setTitle} placeholder="Judul" />
        ) : (
          <Text style={s.title}>{idea.title}</Text>
        )}

        {audioReady && (
          <View style={s.player}>
            <Pressable
              style={s.playBtn}
              onPress={() => (status.playing ? player.pause() : player.play())}
              accessibilityLabel={status.playing ? 'Jeda' : 'Putar'}
            >
              <Text style={s.playText}>{status.playing ? 'Jeda' : 'Putar rekaman'}</Text>
            </Pressable>
            <Text style={s.meta}>
              {formatDuration(status.currentTime * 1000)} / {formatDuration(status.duration * 1000)}
            </Text>
          </View>
        )}

        {editable ? (
          <TextInput
            style={s.bodyInput}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholder="Isi catatan (markdown)"
          />
        ) : (
          <Text style={s.body} selectable>{idea.body_md}</Text>
        )}

        {error && <Text style={s.error}>{error}</Text>}

        {editable && (
          <View style={s.actions}>
            {dirty && (
              <Pressable style={[s.btn, s.btnLight]} onPress={save} disabled={busy}>
                <Text style={s.btnLightText}>Simpan</Text>
              </Pressable>
            )}
            {isDraft && (
              <Pressable style={s.btn} onPress={share} disabled={busy}>
                <Text style={s.btnText}>Bagikan ke tim</Text>
              </Pressable>
            )}
            {isDraft && (
              <Pressable onPress={remove} disabled={busy}>
                <Text style={s.remove}>Hapus draft</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, gap: 14 },
  meta: { fontSize: 13, opacity: 0.65 },
  title: { fontSize: 22, fontWeight: '700' },
  titleInput: { fontSize: 22, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#999', paddingVertical: 6 },
  body: { fontSize: 16, lineHeight: 24 },
  bodyInput: { fontSize: 16, lineHeight: 24, minHeight: 240, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 12 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { backgroundColor: '#eee', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  playText: { color: '#111', fontWeight: '600' },
  actions: { gap: 12, alignItems: 'stretch', marginTop: 8 },
  btn: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnLight: { backgroundColor: '#eee' },
  btnLightText: { color: '#111', fontWeight: '600', fontSize: 16 },
  remove: { color: '#c00', textAlign: 'center', padding: 8 },
  error: { color: '#c00' },
});
