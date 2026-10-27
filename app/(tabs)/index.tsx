import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { Mic } from '../../src/ui/icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { getMe } from '../../src/lib/api';
import { isModelAllowed } from '../../src/lib/device';
import { formatDuration } from '../../src/lib/format';
import { MAX_RECORDING_MS, WARN_BEFORE_END_MS } from '../../src/lib/limits';
import { isModelReady } from '../../src/lib/modelManager';
import { subscribeQueue, type QueueItemList } from '../../src/lib/queueStore';
import { saveRecording } from '../../src/lib/recording';
import { useSettings } from '../../src/lib/settings';
import { makeStyles, useTheme } from '../../src/theme/ThemeContext';
import { palettes } from '../../src/theme/tokens';
import { Badge } from '../../src/ui/Badge';
import { IdeaBurst } from '../../src/ui/IdeaBurst';
import { T } from '../../src/ui/Text';

// Hero Rekam selalu berdasar navy, jadi warnanya diambil dari palet gelap di kedua tema.
const dark = palettes.dark;

type Phase = 'idle' | 'recording' | 'saving' | 'processing';

const BUTTON = 104;
const BARS = [10, 18, 26, 14, 32, 22, 38, 16, 28, 34, 12, 24, 36, 20, 30, 14, 26, 38, 18, 28, 12, 22, 30, 16];

export default function Rekam() {
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });
  const settings = useSettings();
  const network = useNetworkState();
  const s = useStyles();
  const { c } = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [burst, setBurst] = useState(0);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [greeting, setGreeting] = useState(' ');
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
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (ms >= MAX_RECORDING_MS) void stop();
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Ikuti rekaman terakhir sampai jadi ide, draft lokal, atau menunggu.
  const online = !!network.isConnected && network.isInternetReachable !== false;
  const onlineRef = useRef(online);
  onlineRef.current = online;
  useEffect(() => {
    if (!watchId) return;
    return subscribeQueue((items: QueueItemList) => {
    const watched = items.find((i) => i.id === watchId);
    if (!watched) return;
    const online = onlineRef.current;
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
    });
  }, [watchId]);

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
    // "Ide meledak": animasi sekali + getar singkat saat mulai.
    setBurst((n) => n + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    setPhase('saving');
    try {
      const result = await stream.stopFileRecordingAsync();
      stream.stop();
      await setAudioModeAsync({ allowsRecording: false });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <View style={s.root}>
      <View style={s.top}>
        <T variant="small" style={{ color: c.steel }}>{greeting}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Ubah mode transkripsi" onPress={() => router.push('/pengaturan')} hitSlop={8}>
          <Badge kind="draft" label={settings.mode === 'local' ? 'Mode: Selalu lokal' : 'Mode: Cloud + cadangan lokal'} />
        </Pressable>
      </View>

      <View style={s.hero}>
        <Svg width="100%" height="100%" viewBox="0 0 358 420" preserveAspectRatio="xMidYMid slice" style={s.mesh} pointerEvents="none">
          <G stroke={dark.accentSoftBorder} strokeWidth={1} fill="none">
            <Path d="M20 60 L120 30 L230 80 L340 40" />
            <Path d="M120 30 L150 170 L230 80 L300 200 L340 40" />
            <Path d="M10 330 L110 280 L220 360 L340 300" />
          </G>
          <G fill={c.shieldBlue}>
            <Circle cx={120} cy={30} r={3} />
            <Circle cx={230} cy={80} r={4} />
            <Circle cx={300} cy={200} r={3} />
            <Circle cx={110} cy={280} r={3} />
            <Circle cx={220} cy={360} r={4} />
          </G>
        </Svg>

        <View style={s.status}>
          {recording && <View style={s.dot} />}
          <T variant="caption" style={{ color: recording ? c.onDark : c.onDarkMuted, fontFamily: 'Inter_600SemiBold' }}>
            {recording ? 'Merekam' : busy ? (phase === 'saving' ? 'Menyimpan…' : 'Mentranskrip…') : 'Siap merekam'}
          </T>
        </View>
        <T variant="stat" style={{ color: c.onDark }} accessibilityLabel={`Durasi ${formatDuration(recording ? elapsed : 0)}`}>
          {formatDuration(recording ? elapsed : 0)}
        </T>
        <T variant="small" style={{ color: c.onDarkMuted }}>
          {recording ? `Sisa ${formatDuration(Math.max(0, MAX_RECORDING_MS - elapsed))} · maks 02:00` : 'Maks 02:00'}
        </T>

        <View style={s.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {BARS.map((h, i) => (
            <View key={i} style={[s.bar, { height: recording ? h : Math.max(6, h / 3), backgroundColor: recording ? c.shieldBlue : dark.accentSoftBorder }]} />
          ))}
        </View>

        <View style={s.buttonWrap}>
          <IdeaBurst trigger={burst} size={BUTTON} />
          {busy ? (
            <View style={[s.recButton, { backgroundColor: c.navy900 }]}>
              <ActivityIndicator size="large" color={c.shieldBlue} />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Berhenti merekam' : 'Mulai merekam'}
              onPress={recording ? stop : start}
              style={({ pressed }) => [s.recButton, { backgroundColor: recording ? c.destructive : c.shieldBlue }, pressed && { opacity: 0.9 }]}
            >
              {recording ? <View style={s.stopIcon} /> : <Mic size={36} color={dark.onPrimary} strokeWidth={2} />}
            </Pressable>
          )}
        </View>

        <T variant="body" style={{ color: c.onDark }}>
          {recording ? 'Ngomong aja… tap untuk selesai' : busy ? ' ' : 'Ada ide? Tap dan ngomong'}
        </T>
      </View>

      {notice && (
        <T variant="small" style={[s.notice, notice.error && { color: c.dangerInk }]} accessibilityLiveRegion="polite">
          {notice.text}
        </T>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ c, radius, space }) => ({
  root: { flex: 1, backgroundColor: c.background, padding: space.md, gap: space.sm },
  top: { gap: 6 },
  // Hero layar Rekam selalu navy-950 (dasar gelap brand) di kedua tema.
  hero: { flex: 1, borderRadius: radius.xxl, backgroundColor: c.navy950, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: space.md },
  mesh: { position: 'absolute', top: 0, left: 0, opacity: 0.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.destructive },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 },
  bar: { width: 4, borderRadius: 2 },
  buttonWrap: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  recButton: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, borderWidth: 6, borderColor: dark.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stopIcon: { width: 32, height: 32, borderRadius: 6, backgroundColor: dark.onDark },
  notice: { textAlign: 'center', color: c.steel, paddingHorizontal: space.sm },
}));
