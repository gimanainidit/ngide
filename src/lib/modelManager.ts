import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { releaseLocalWhisper } from './localWhisper';
import { MODELS, modelInfo, verifyDownload, type ModelId } from './models';

export type ModelStatus =
  | { state: 'none' }
  | { state: 'downloading'; progress: number }
  | { state: 'paused'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string };

const dir = new Directory(Paths.document, 'models');
const resumeKey = (id: ModelId) => `ngide.modeldl.${id}`;
const tasks = new Map<ModelId, DownloadTask>();
const statuses = new Map<ModelId, ModelStatus>();
const listeners = new Set<() => void>();

const finalFile = (id: ModelId) => new File(dir, modelInfo(id).file);
const partFile = (id: ModelId) => new File(dir, `${modelInfo(id).file}.part`);

export function modelPath(id: ModelId): string {
  return finalFile(id).uri;
}

export function isModelReady(id: ModelId): boolean {
  const f = finalFile(id);
  return f.exists && (f.size ?? 0) > 0;
}

export function getModelStatus(id: ModelId): ModelStatus {
  return statuses.get(id) ?? (isModelReady(id) ? { state: 'ready' } : { state: 'none' });
}

function setStatus(id: ModelId, status: ModelStatus) {
  statuses.set(id, status);
  listeners.forEach((l) => l());
}

export function useModelStatuses(): Record<ModelId, ModelStatus> {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return Object.fromEntries(MODELS.map((m) => [m.id, getModelStatus(m.id)])) as Record<ModelId, ModelStatus>;
}

export async function isOnWifi(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return state.type === Network.NetworkStateType.WIFI;
}

export async function downloadModel(id: ModelId): Promise<void> {
  if (tasks.has(id) || isModelReady(id)) return;
  const info = modelInfo(id);
  dir.create({ intermediates: true, idempotent: true });

  let expected: number | null = null;
  const savedRaw = await AsyncStorage.getItem(resumeKey(id));
  const saved = savedRaw ? JSON.parse(savedRaw) : null;
  const options = {
    onProgress: ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
      if (totalBytes > 0) expected = totalBytes;
      const total = totalBytes > 0 ? totalBytes : info.approxBytes;
      setStatus(id, { state: 'downloading', progress: Math.min(1, bytesWritten / total) });
    },
  };
  const task = saved ? DownloadTask.fromSavable(saved, options) : File.createDownloadTask(info.url, partFile(id), options);
  tasks.set(id, task);
  setStatus(id, { state: 'downloading', progress: 0 });

  try {
    const file = saved ? await task.resumeAsync() : await task.downloadAsync();
    if (!file) return; // dijeda atau dibatalkan
    const part = partFile(id);
    const problem = verifyDownload({ expectedBytes: expected, actualBytes: part.size ?? 0, approxBytes: info.approxBytes });
    if (problem) {
      part.delete();
      throw new Error(problem);
    }
    await part.move(finalFile(id));
    await AsyncStorage.removeItem(resumeKey(id));
    setStatus(id, { state: 'ready' });
  } catch (e) {
    await AsyncStorage.removeItem(resumeKey(id));
    setStatus(id, { state: 'error', message: e instanceof Error ? e.message : 'Unduhan gagal' });
  } finally {
    tasks.delete(id);
  }
}

export async function pauseModelDownload(id: ModelId) {
  const task = tasks.get(id);
  if (!task) return;
  await task.pauseAsync();
  // Simpan agar bisa dilanjutkan walau app ditutup.
  await AsyncStorage.setItem(resumeKey(id), JSON.stringify(task.savable()));
  const current = getModelStatus(id);
  setStatus(id, { state: 'paused', progress: current.state === 'downloading' ? current.progress : 0 });
  tasks.delete(id);
}

export async function cancelModelDownload(id: ModelId) {
  tasks.get(id)?.cancel();
  tasks.delete(id);
  await AsyncStorage.removeItem(resumeKey(id));
  const part = partFile(id);
  if (part.exists) part.delete();
  setStatus(id, { state: 'none' });
}

export async function deleteModel(id: ModelId) {
  await cancelModelDownload(id);
  await releaseLocalWhisper();
  const f = finalFile(id);
  if (f.exists) f.delete();
  setStatus(id, { state: 'none' });
}

export async function hasPausedDownload(id: ModelId) {
  return (await AsyncStorage.getItem(resumeKey(id))) !== null;
}
