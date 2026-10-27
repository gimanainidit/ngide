import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatDuration } from '../../src/lib/format';
import { editLocalDraft } from '../../src/lib/queue';
import { removeItem, upsertItem, useQueue } from '../../src/lib/queueStore';
import { deleteLocalAudio } from '../../src/lib/recording';
import { runQueue } from '../../src/lib/syncRunner';

// Draft hasil transkripsi di HP, sebelum tersinkron ke server.
export default function LocalDraft() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useQueue().find((i) => i.id === id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const player = useAudioPlayer(item?.uri ?? null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (item?.local) {
      setTitle(item.local.title);
      setBody(item.local.body_md);
    }
    // Hanya isi awal; editan user tidak boleh ditimpa saat antrean berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, !!item?.local]);

  if (item?.stage === 'server_done' && item.ideaId) return <Redirect href={`/ide/${item.ideaId}`} />;
  if (!item?.local) {
    return (
      <View style={s.center}>
        <Text>Draft tidak ditemukan.</Text>
      </View>
    );
  }

  const dirty = title !== item.local.title || body !== item.local.body_md;

  async function save() {
    if (!item) return;
    await upsertItem(editLocalDraft(item, title, body));
    void runQueue();
  }

  function remove() {
    Alert.alert('Hapus draft lokal?', 'Rekaman dan transkrip di HP ini akan dihapus. Belum ada yang terkirim ke tim.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          deleteLocalAudio(item!.uri);
          await removeItem(item!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.meta}>Draft lokal · ditranskrip di HP · akan dikirim saat online</Text>
        <TextInput style={s.titleInput} value={title} onChangeText={setTitle} placeholder="Judul" />
        <View style={s.player}>
          <Pressable style={s.playBtn} onPress={() => (status.playing ? player.pause() : player.play())}>
            <Text style={s.playText}>{status.playing ? 'Jeda' : 'Putar rekaman'}</Text>
          </Pressable>
          <Text style={s.meta}>
            {formatDuration(status.currentTime * 1000)} / {formatDuration(item.durationMs)}
          </Text>
        </View>
        <TextInput style={s.bodyInput} value={body} onChangeText={setBody} multiline textAlignVertical="top" />
        {dirty && (
          <Pressable style={s.btn} onPress={save}>
            <Text style={s.btnText}>Simpan</Text>
          </Pressable>
        )}
        <Pressable onPress={remove}>
          <Text style={s.remove}>Hapus draft lokal</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 14 },
  meta: { fontSize: 13, opacity: 0.65 },
  titleInput: { fontSize: 22, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#999', paddingVertical: 6 },
  bodyInput: { fontSize: 16, lineHeight: 24, minHeight: 240, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 12 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { backgroundColor: '#eee', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  playText: { color: '#111', fontWeight: '600' },
  btn: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  remove: { color: '#c00', textAlign: 'center', padding: 8 },
});
