import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { Badge } from '../ui/Badge';
import { PressableCard } from '../ui/Card';
import { T } from '../ui/Text';
import { isModelAllowed } from './device';
import { formatDuration, timeAgo } from './format';
import { isModelReady } from './modelManager';
import { describePending } from './policy';
import { removeItem, useQueue } from './queueStore';
import { deleteLocalAudio } from './recording';
import { useSettings } from './settings';

// Rekaman yang belum menjadi ide di server.
export function PendingList() {
  const s = useStyles();
  const { c } = useTheme();
  const queue = useQueue();
  const settings = useSettings();
  const network = useNetworkState();
  const online = !!network.isConnected && network.isInternetReachable !== false;
  const modelReady = isModelAllowed(settings.model) && isModelReady(settings.model);
  const pending = queue.filter((i) => i.stage !== 'server_done');
  if (pending.length === 0) return null;

  return (
    <View style={s.box}>
      <T variant="eyebrow">Belum tersinkron ({pending.length})</T>
      {pending.map((item) => {
        const failed = item.stage === 'failed_permanent';
        return (
          <PressableCard
            key={item.id}
            tone="dashed"
            accessibilityLabel={item.local ? 'Buka draft lokal' : failed ? 'Hapus rekaman gagal' : 'Rekaman menunggu diproses'}
            onPress={() => {
              if (item.local) router.push(`/draf/${item.id}`);
              else if (failed)
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
            <View style={s.row}>
              <T variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                {item.local?.title ?? `Rekaman ${formatDuration(item.durationMs)}`}
              </T>
              {item.local ? <Badge kind="local" label="Draft lokal" /> : null}
            </View>
            <T variant="caption" style={failed ? { color: c.dangerInk } : undefined}>
              {describePending(item, { online, modelReady })} · {timeAgo(new Date(item.createdAt).toISOString())}
            </T>
          </PressableCard>
        );
      })}
      <T variant="eyebrow" style={{ marginTop: 8 }}>Ide saya</T>
    </View>
  );
}

const useStyles = makeStyles(({ space }) => ({
  box: { gap: space.sm, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
}));
