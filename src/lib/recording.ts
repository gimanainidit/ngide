import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { MAX_RECORDING_MS } from './limits';
import { newItem, type QueueItem } from './queue';
import { upsertItem } from './queueStore';
import { getSettings } from './settings';
import { runQueue } from './syncRunner';
import { toWhisperWav, wavDurationMs } from './wav';

const dir = new Directory(Paths.document, 'recordings');

// Simpan rekaman sebagai WAV 16 kHz mono di HP, masukkan antrean, lalu picu sinkron.
export async function saveRecording(rawUri: string): Promise<QueueItem> {
  dir.create({ intermediates: true, idempotent: true });
  const source = new File(rawUri);
  const bytes = await source.bytes();
  const wav = toWhisperWav(bytes);
  const id = randomUUID();
  const dest = new File(dir, `${id}.wav`);
  if (wav === bytes) {
    await source.move(dest);
  } else {
    await dest.write(wav);
    source.delete();
  }
  const settings = await getSettings();
  const item = newItem({
    id,
    uri: dest.uri,
    durationMs: Math.min(wavDurationMs(wav), MAX_RECORDING_MS),
    now: Date.now(),
    mode: settings.mode,
    polish: settings.polish,
  });
  await upsertItem(item);
  void runQueue();
  return item;
}

export function deleteLocalAudio(uri: string) {
  const f = new File(uri);
  if (f.exists) f.delete();
}
