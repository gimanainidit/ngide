import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pause, Play, Trash2 } from '../../src/ui/icons';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { formatDuration } from '../../src/lib/format';
import { editLocalDraft, type LocalDraft, type QueueItem } from '../../src/lib/queue';
import { removeItem, upsertItem, useQueue } from '../../src/lib/queueStore';
import { deleteLocalAudio } from '../../src/lib/recording';
import { runQueue } from '../../src/lib/syncRunner';
import { makeStyles, useTheme } from '../../src/theme/ThemeContext';
import { TOUCH } from '../../src/theme/tokens';
import { Badge } from '../../src/ui/Badge';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { CenterState, Screen } from '../../src/ui/Screen';
import { T } from '../../src/ui/Text';

// Draft hasil transkripsi di HP, sebelum tersinkron ke server.
export default function LocalDraftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useQueue().find((i) => i.id === id);
  if (item?.stage === 'server_done' && item.ideaId) return <Redirect href={`/ide/${item.ideaId}`} />;
  if (!item?.local) return <CenterState error="Draft tidak ditemukan." />;
  // key: editor baru setiap draft berbeda, nilai awal diambil langsung dari draft.
  return <DraftEditor key={item.id} item={item as QueueItem & { local: LocalDraft }} />;
}

function DraftEditor({ item }: { item: QueueItem & { local: LocalDraft } }) {
  const s = useStyles();
  const { c } = useTheme();
  const [title, setTitle] = useState(item.local.title);
  const [body, setBody] = useState(item.local.body_md);
  const player = useAudioPlayer(item.uri);
  const status = useAudioPlayerStatus(player);

  const dirty = title !== item.local.title || body !== item.local.body_md;

  async function save() {
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
          deleteLocalAudio(item.uri);
          await removeItem(item.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <View style={s.metaRow}>
        <Badge kind="local" label="Draft lokal" />
        <T variant="caption" style={{ flex: 1 }}>Ditranskrip di HP · dikirim otomatis saat online</T>
      </View>
      <Field label="Judul" value={title} onChangeText={setTitle} big />
      <View style={s.player}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Jeda rekaman' : 'Putar rekaman'}
          onPress={() => (status.playing ? player.pause() : player.play())}
          style={s.playBtn}
        >
          {status.playing ? <Pause size={20} color={c.inkStrong} /> : <Play size={20} color={c.inkStrong} />}
        </Pressable>
        <T variant="caption">
          {formatDuration(status.currentTime * 1000)} / {formatDuration(item.durationMs)}
        </T>
      </View>
      <Field label="Isi (markdown)" value={body} onChangeText={setBody} multiline />
      {dirty && <Button label="Simpan" variant="primary" onPress={save} />}
      <Button label="Hapus draft lokal" variant="danger" icon={Trash2} onPress={remove} />
    </Screen>
  );
}

const useStyles = makeStyles(({ c, radius, space }) => ({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
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
}));
