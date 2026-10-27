import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { isModelAllowed } from './device';
import { formatDuration, timeAgo } from './format';
import { isModelReady } from './modelManager';
import { describePending } from './policy';
import { removeItem, useQueue } from './queueStore';
import { deleteLocalAudio } from './recording';
import { useSettings } from './settings';

// Rekaman yang belum menjadi ide di server.
export function PendingList() {
  const queue = useQueue();
  const settings = useSettings();
  const network = useNetworkState();
  const online = !!network.isConnected && network.isInternetReachable !== false;
  const modelReady = isModelAllowed(settings.model) && isModelReady(settings.model);
  const pending = queue.filter((i) => i.stage !== 'server_done');
  if (pending.length === 0) return null;

  return (
    <View style={s.box}>
      <Text style={s.heading}>Belum tersinkron ({pending.length})</Text>
      {pending.map((item) => (
        <Pressable
          key={item.id}
          style={s.row}
          onPress={() => {
            if (item.local) router.push(`/draf/${item.id}`);
            else if (item.stage === 'failed_permanent')
              Alert.alert('Hapus rekaman ini?', item.lastError ?? '', [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Hapus',
                  style: 'destructive',
                  onPress: async () => {
                    deleteLocalAudio(item.uri);
                    await removeItem(item.id);
                  },
                },
              ]);
          }}
        >
          <Text style={s.title} numberOfLines={1}>
            {item.local?.title ?? `Rekaman ${formatDuration(item.durationMs)}`}
          </Text>
          <Text style={[s.meta, item.stage === 'failed_permanent' && s.error]}>
            {describePending(item, { online, modelReady })} · {timeAgo(new Date(item.createdAt).toISOString())}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: 8, marginBottom: 12 },
  heading: { fontSize: 13, fontWeight: '700', opacity: 0.7 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderStyle: 'dashed', borderRadius: 12, padding: 12, gap: 4 },
  title: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, opacity: 0.65 },
  error: { color: '#c00', opacity: 1 },
});
