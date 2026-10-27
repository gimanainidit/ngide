import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { runQueue } from '../src/lib/syncRunner';

const MB = 1024 * 1024;

export default function Pengaturan() {
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

  function chooseModel(id: ModelId) {
    void updateSettings({ model: id }).then(() => runQueue());
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.section}>Mode transkripsi</Text>
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

      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.optionTitle}>Rapikan dengan AI</Text>
          <Text style={s.optionBody}>
            Teks transkrip dikirim ke LLM (Groq) untuk dibuatkan judul dan poin. Kalau draft sudah kamu edit, hasilnya hanya jadi saran.
          </Text>
        </View>
        <Switch value={settings.polish} onValueChange={(polish) => void updateSettings({ polish })} />
      </View>

      <Text style={s.section}>Model di HP</Text>
      {models.map((m) => (
        <ModelRow
          key={m.id}
          model={m}
          status={statuses[m.id]}
          paused={!!paused[m.id]}
          selected={settings.model === m.id}
          onSelect={() => chooseModel(m.id)}
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
      <Text style={s.footnote}>Model diunduh dari Hugging Face (whisper.cpp). Rekaman maksimal 2 menit.</Text>
    </ScrollView>
  );
}

function Option(p: { selected: boolean; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable style={[s.option, p.selected && s.optionSelected]} onPress={p.onPress} accessibilityState={{ selected: p.selected }}>
      <Text style={s.optionTitle}>
        {p.selected ? '● ' : '○ '}
        {p.title}
      </Text>
      <Text style={s.optionBody}>{p.body}</Text>
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
  const { model, status } = p;
  const size = `±${Math.round(model.approxBytes / MB)} MB`;
  return (
    <View style={[s.option, p.selected && status.state === 'ready' && s.optionSelected]}>
      <Text style={s.optionTitle}>
        {model.label} · {size}
      </Text>
      <Text style={s.optionBody}>{model.allowed ? model.description : model.reason}</Text>
      {model.allowed && (
        <View style={s.actions}>
          {status.state === 'ready' && (
            <>
              <Btn label={p.selected ? 'Dipakai' : 'Pakai model ini'} onPress={p.onSelect} disabled={p.selected} />
              <Btn label="Hapus" onPress={p.onDelete} danger />
            </>
          )}
          {status.state === 'downloading' && (
            <>
              <Text style={s.progress}>{Math.round(status.progress * 100)}%</Text>
              <Btn label="Jeda" onPress={p.onPause} />
              <Btn label="Batal" onPress={p.onCancel} danger />
            </>
          )}
          {(status.state === 'paused' || (status.state === 'none' && p.paused)) && (
            <>
              <Btn label="Lanjutkan" onPress={p.onDownload} />
              <Btn label="Batal" onPress={p.onCancel} danger />
            </>
          )}
          {status.state === 'none' && !p.paused && <Btn label="Unduh" onPress={p.onDownload} />}
          {status.state === 'error' && (
            <>
              <Text style={s.error}>{status.message}</Text>
              <Btn label="Coba lagi" onPress={p.onDownload} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function Btn(p: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable style={[s.btn, p.disabled && { opacity: 0.5 }]} onPress={p.onPress} disabled={p.disabled}>
      <Text style={[s.btnText, p.danger && { color: '#c00' }]}>{p.label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  section: { fontSize: 13, fontWeight: '700', opacity: 0.7, marginTop: 8 },
  option: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 14, gap: 6 },
  optionSelected: { borderColor: '#111', borderWidth: 2 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionBody: { fontSize: 13, opacity: 0.75, lineHeight: 19 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  btn: { backgroundColor: '#eee', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  btnText: { color: '#111', fontWeight: '600' },
  progress: { fontVariant: ['tabular-nums'], fontWeight: '600' },
  error: { color: '#c00' },
  footnote: { fontSize: 12, opacity: 0.55, marginTop: 8 },
});
