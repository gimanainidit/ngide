import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { getMe } from '../../src/lib/api';
import { isModelAllowed } from '../../src/lib/device';
import { formatDuration } from '../../src/lib/format';
import { MAX_RECORDING_MS, WARN_BEFORE_END_MS } from '../../src/lib/limits';
import { isModelReady } from '../../src/lib/modelManager';
import { useQueue } from '../../src/lib/queueStore';
import { saveRecording } from '../../src/lib/recording';
import { useSettings } from '../../src/lib/settings';

type Phase = 'idle' | 'recording' | 'saving' | 'processing';

export default function Rekam() {
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });
  const settings = useSettings();
  const network = useNetworkState();
  const queue = useQueue();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [greeting, setGreeting] = useState('...');
  const startedAt = useRef(0);
  const warned = useRef(false);
  const stopping = useRef(false);

  useEffect(() => {
    getMe()
      .then((me) => setGreeting(`Halo ${me.name} · Tim ${me.team?.name ?? '-'}`))
      .catch(() => setGreeting('Halo'));
  }, []);

  // Timer + batas 2 menit.
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (!warned.current && ms >= MAX_RECORDING_MS - WARN_BEFORE_END_MS) {
        warned.current = true;
        Vibration.vibrate(150);
      }
      if (ms >= MAX_RECORDING_MS) void stop();
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Ikuti rekaman terakhir sampai jadi ide, draft lokal, atau menunggu.
  const watched = queue.find((i) => i.id === watchId);
  const online = !!network.isConnected && network.isInternetReachable !== false;
  useEffect(() => {
    if (!watched) return;
    if (watched.stage === 'server_done' && watched.ideaId) {
      setWatchId(null);
      setPhase('idle');
      router.push(`/ide/${watched.ideaId}`);
    } else if (watched.stage === 'local_transcribed' && (!online || watched.mode === 'local')) {
      setWatchId(null);
      setPhase('idle');
      router.push(`/draf/${watched.id}`);
    } else if (watched.stage === 'failed_permanent') {
      setWatchId(null);
      setPhase('idle');
      setNotice({ text: watched.lastError ?? 'Gagal memproses rekaman', error: true });
    } else if (watched.stage === 'recorded' && (watched.attempts > 0 || (!online && watched.mode === 'cloud'))) {
      setWatchId(null);
      setPhase('idle');
      setNotice({ text: 'Tersimpan di HP. Akan diproses otomatis begitu memungkinkan.' });
    }
  }, [watched, online]);

  async function start() {
    if (settings.mode === 'local' && !(isModelAllowed(settings.model) && isModelReady(settings.model))) {
      Alert.alert('Model belum siap', 'Mode Selalu lokal butuh model transkripsi di HP. Unduh dulu di Pengaturan.', [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Buka Pengaturan', onPress: () => router.push('/pengaturan') },
      ]);
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin mikrofon dibutuhkan', 'Aktifkan izin mikrofon untuk Ngide di pengaturan HP.');
      return;
    }
    setNotice(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await stream.start();
    await stream.startFileRecordingAsync({ directory: 'document', format: 'wav' });
    startedAt.current = Date.now();
    warned.current = false;
    stopping.current = false;
    setElapsed(0);
    setPhase('recording');
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    setPhase('saving');
    try {
      const result = await stream.stopFileRecordingAsync();
      stream.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (Date.now() - startedAt.current >= MAX_RECORDING_MS) Vibration.vibrate([0, 120, 80, 120]);
      const item = await saveRecording(result.uri);
      setWatchId(item.id);
      setPhase('processing');
    } catch (e) {
      setPhase('idle');
      setNotice({ text: e instanceof Error ? e.message : 'Rekaman tidak tersimpan', error: true });
    }
  }

  const recording = phase === 'recording';
  const busy = phase === 'saving' || phase === 'processing';
  return (
    <View style={s.container}>
      <Text style={s.greeting}>{greeting}</Text>
      <Text style={s.mode} onPress={() => router.push('/pengaturan')}>
        {settings.mode === 'local' ? 'Mode: Selalu lokal' : 'Mode: Cloud + cadangan lokal'} · ubah
      </Text>

      <View style={s.center}>
        <Text style={s.timer}>{formatDuration(recording ? elapsed : 0)}</Text>
        <Text style={s.remaining}>
          {recording ? `Sisa ${formatDuration(Math.max(0, MAX_RECORDING_MS - elapsed))}` : `Maks ${formatDuration(MAX_RECORDING_MS)}`}
        </Text>

        {busy ? (
          <View style={s.processing}>
            <ActivityIndicator size="large" />
            <Text style={s.hint}>{phase === 'saving' ? 'Menyimpan…' : 'Mentranskrip…'}</Text>
          </View>
        ) : (
          <Pressable
            accessibilityLabel={recording ? 'Berhenti merekam' : 'Mulai merekam'}
            style={[s.rec, recording && s.recActive]}
            onPress={recording ? stop : start}
          >
            <View style={recording ? s.stopIcon : s.micIcon} />
          </Pressable>
        )}

        <Text style={s.hint}>{recording ? 'Ngomong aja… tap untuk selesai' : busy ? '' : 'Tap untuk mulai merekam ide'}</Text>
        {notice && <Text style={[s.notice, notice.error && s.error]}>{notice.text}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  greeting: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  mode: { fontSize: 13, opacity: 0.6, textAlign: 'center', marginTop: 4, textDecorationLine: 'underline' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  timer: { fontSize: 48, fontVariant: ['tabular-nums'], fontWeight: '300' },
  remaining: { fontSize: 14, opacity: 0.6, fontVariant: ['tabular-nums'] },
  rec: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' },
  recActive: { backgroundColor: '#111' },
  micIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff' },
  stopIcon: { width: 34, height: 34, borderRadius: 6, backgroundColor: '#fff' },
  hint: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  processing: { alignItems: 'center', gap: 12, height: 120, justifyContent: 'center' },
  notice: { textAlign: 'center', paddingHorizontal: 12, opacity: 0.8 },
  error: { color: '#c00', opacity: 1 },
});
