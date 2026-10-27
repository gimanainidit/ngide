import { Circle, CircleDot, Download, LogOut, Pause, Play, Trash2, X } from '../src/ui/icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { deviceModels } from '../src/lib/device';
import {
  cancelModelDownload,
  deleteModel,
  downloadModel,
  hasPausedDownload,
  isOnWifi,
  pauseModelDownload,
  useModelStatuses,
  type ModelStatus,
} from '../src/lib/modelManager';
import type { ModelId, ModelOption } from '../src/lib/models';
import { updateSettings, useSettings } from '../src/lib/settings';
import { supabase } from '../src/lib/supabase';
import { runQueue } from '../src/lib/syncRunner';
import { makeStyles, useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/ui/Button';
import { Card } from '../src/ui/Card';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/Text';

const MB = 1024 * 1024;

export default function Pengaturan() {
  const s = useStyles();
  const { c } = useTheme();
  const settings = useSettings();
  const statuses = useModelStatuses();
  const models = deviceModels();
  const [paused, setPaused] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all(models.map(async (m) => [m.id, await hasPausedDownload(m.id)] as const)).then((pairs) =>
      setPaused(Object.fromEntries(pairs)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startDownload(m: ModelOption) {
    const go = () => {
      setPaused((p) => ({ ...p, [m.id]: false }));
      void downloadModel(m.id).then(() => runQueue());
    };
    if (await isOnWifi()) return go();
    Alert.alert('Tidak memakai Wi-Fi', `Model ini sekitar ${Math.round(m.approxBytes / MB)} MB. Unduh pakai data seluler?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Unduh', onPress: go },
    ]);
  }

  const signOut = () =>
    Alert.alert('Keluar dari Ngide?', 'Rekaman yang belum tersinkron tetap tersimpan di HP ini.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => void supabase.auth.signOut() },
    ]);

  return (
    <Screen>
      <T variant="eyebrow">Mode transkripsi</T>
      <Option
        selected={settings.mode === 'cloud'}
        title="Cloud + cadangan lokal (disarankan)"
        body="Audio ditranskrip di server (lebih akurat). Saat offline atau server gagal, HP mentranskrip dulu, lalu server mentranskrip ulang saat online."
        onPress={() => void updateSettings({ mode: 'cloud' }).then(() => runQueue())}
      />
      <Option
        selected={settings.mode === 'local'}
        title="Selalu lokal"
        body="Transkripsi selalu di HP. Audio tidak pernah keluar dari HP ini dan hanya bisa diputar di sini. Teks tetap dikirim ke server agar bisa dibagikan ke tim."
        onPress={() => void updateSettings({ mode: 'local' }).then(() => runQueue())}
      />

      <Card>
        <View style={s.switchRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="heading">Rapikan dengan AI</T>
            <T variant="caption">
              Teks transkrip dikirim ke LLM (Groq) untuk dibuatkan judul dan poin. Kalau draft sudah kamu edit, hasilnya hanya jadi saran.
            </T>
          </View>
          <Switch
            accessibilityLabel="Rapikan dengan AI"
            value={settings.polish}
            onValueChange={(polish) => void updateSettings({ polish })}
            trackColor={{ true: c.primary, false: c.hairlineStrong }}
            thumbColor={c.canvas}
          />
        </View>
      </Card>

      <T variant="eyebrow" style={{ marginTop: 8 }}>Model di HP</T>
      {models.map((m) => (
        <ModelRow
          key={m.id}
          model={m}
          status={statuses[m.id]}
          paused={!!paused[m.id]}
          selected={settings.model === m.id}
          onSelect={() => void updateSettings({ model: m.id as ModelId }).then(() => runQueue())}
          onDownload={() => startDownload(m)}
          onPause={() => void pauseModelDownload(m.id).then(() => setPaused((p) => ({ ...p, [m.id]: true })))}
          onCancel={() => void cancelModelDownload(m.id).then(() => setPaused((p) => ({ ...p, [m.id]: false })))}
          onDelete={() =>
            Alert.alert(`Hapus model ${m.label}?`, 'Bisa diunduh lagi kapan saja.', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Hapus', style: 'destructive', onPress: () => void deleteModel(m.id) },
            ])
          }
        />
      ))}
      <T variant="caption">Model diunduh dari Hugging Face (whisper.cpp). Rekaman maksimal 2 menit.</T>

      <Button label="Keluar" variant="danger" icon={LogOut} onPress={signOut} style={{ marginTop: 16 }} />
    </Screen>
  );
}

function Option(p: { selected: boolean; title: string; body: string; onPress: () => void }) {
  const s = useStyles();
  const { c } = useTheme();
  const Icon = p.selected ? CircleDot : Circle;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: p.selected }}
      onPress={p.onPress}
      style={({ pressed }) => [s.option, p.selected && s.optionSelected, pressed && { opacity: 0.85 }]}
    >
      <Icon size={22} color={p.selected ? c.primary : c.steel} strokeWidth={2} />
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="heading">{p.title}</T>
        <T variant="caption">{p.body}</T>
      </View>
    </Pressable>
  );
}

function ModelRow(p: {
  model: ModelOption;
  status: ModelStatus;
  paused: boolean;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onPause: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const s = useStyles();
  const { c } = useTheme();
  const { model, status } = p;
  const size = `±${Math.round(model.approxBytes / MB)} MB`;
  return (
    <Card style={p.selected && status.state === 'ready' ? s.optionSelected : undefined}>
      <T variant="heading">
        {model.label} · {size}
      </T>
      <T variant="caption">{model.allowed ? model.description : model.reason}</T>
      {model.allowed && (
        <View style={s.actions}>
          {status.state === 'ready' && (
            <>
              <Button label={p.selected ? 'Dipakai' : 'Pakai model ini'} variant={p.selected ? 'secondary' : 'soft'} onPress={p.onSelect} disabled={p.selected} />
              <Button label="Hapus" variant="danger" icon={Trash2} onPress={p.onDelete} />
            </>
          )}
          {status.state === 'downloading' && (
            <>
              <View style={s.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(status.progress * 100) }}>
                <View style={[s.progressFill, { width: `${Math.round(status.progress * 100)}%` }]} />
              </View>
              <T variant="caption" style={{ color: c.ink }}>{Math.round(status.progress * 100)}%</T>
              <Button label="Jeda" icon={Pause} onPress={p.onPause} />
              <Button label="Batal" variant="danger" icon={X} onPress={p.onCancel} />
            </>
          )}
          {(status.state === 'paused' || (status.state === 'none' && p.paused)) && (
            <>
              <Button label="Lanjutkan" variant="soft" icon={Play} onPress={p.onDownload} />
              <Button label="Batal" variant="danger" icon={X} onPress={p.onCancel} />
            </>
          )}
          {status.state === 'none' && !p.paused && <Button label="Unduh" variant="soft" icon={Download} onPress={p.onDownload} />}
          {status.state === 'error' && (
            <>
              <T variant="small" style={{ color: c.dangerInk, width: '100%' }}>{status.message}</T>
              <Button label="Coba lagi" variant="soft" icon={Download} onPress={p.onDownload} />
            </>
          )}
        </View>
      )}
    </Card>
  );
}

const useStyles = makeStyles(({ c, radius, space }) => ({
  option: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: c.canvas,
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: radius.xl,
    padding: space.md,
  },
  optionSelected: { borderColor: c.primary, borderWidth: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginTop: 4 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: c.hairline, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: c.link },
}));
