import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getMe,
  newPendingRecording,
  uploadAndTranscribe,
  type PendingRecording,
} from '../../src/lib/api';
import { formatDuration } from '../../src/lib/format';

const MAX_MS = 10 * 60 * 1000;
const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
  directory: 'document' as const,
};

type Phase = 'idle' | 'recording' | 'processing' | 'failed';

export default function Rekam() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState<PendingRecording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('...');

  useEffect(() => {
    getMe()
      .then((me) => setGreeting(`Halo ${me.name} · Tim ${me.team?.name ?? '-'}`))
      .catch(() => setGreeting('Halo'));
  }, []);

  useEffect(() => {
    if (phase === 'recording' && state.durationMillis >= MAX_MS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.durationMillis, phase]);

  async function start() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin mikrofon dibutuhkan', 'Aktifkan izin mikrofon untuk Ngide di pengaturan HP.');
      return;
    }
    setError(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  }

  async function stop() {
    const durationMs = state.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) {
      setError('Rekaman tidak tersimpan');
      setPhase('failed');
      return;
    }
    await process(newPendingRecording(uri, durationMs));
  }

  async function process(p: PendingRecording) {
    setPending(p);
    setPhase('processing');
    setError(null);
    try {
      const ideaId = await uploadAndTranscribe(p);
      setPending(null);
      setPhase('idle');
      router.push(`/ide/${ideaId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses rekaman');
      setPhase('failed');
    }
  }

  const recording = phase === 'recording';
  return (
    <View style={s.container}>
      <Text style={s.greeting}>{greeting}</Text>

      <View style={s.center}>
        <Text style={s.timer}>{formatDuration(recording ? state.durationMillis : 0)}</Text>

        {phase === 'processing' ? (
          <View style={s.processing}>
            <ActivityIndicator size="large" />
            <Text style={s.hint}>Mengunggah & mentranskrip…</Text>
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

        <Text style={s.hint}>
          {recording ? 'Ngomong aja… tap untuk selesai' : phase === 'idle' ? 'Tap untuk mulai merekam ide' : ''}
        </Text>

        {phase === 'failed' && (
          <View style={s.errorBox}>
            <Text style={s.error}>{error}</Text>
            {pending && (
              <Pressable style={s.retry} onPress={() => process(pending)}>
                <Text style={s.retryText}>Coba lagi</Text>
              </Pressable>
            )}
            <Text style={s.hintSmall}>Rekamanmu aman tersimpan di HP.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  greeting: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  timer: { fontSize: 48, fontVariant: ['tabular-nums'], fontWeight: '300' },
  rec: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' },
  recActive: { backgroundColor: '#111' },
  micIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff' },
  stopIcon: { width: 34, height: 34, borderRadius: 6, backgroundColor: '#fff' },
  hint: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  hintSmall: { fontSize: 13, opacity: 0.6, textAlign: 'center' },
  processing: { alignItems: 'center', gap: 12, height: 120, justifyContent: 'center' },
  errorBox: { alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  error: { color: '#c00', textAlign: 'center' },
  retry: { backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
});
