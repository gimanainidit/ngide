import { File } from 'expo-file-system';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getMe } from './api';
import { isModelAllowed } from './device';
import { transcribeLocal } from './localWhisper';
import { isModelReady, modelPath } from './modelManager';
import { processItem, SyncError, type Deps } from './processItem';
import { isDue } from './queue';
import { getQueue, removeItem, upsertItem } from './queueStore';
import { getSettings } from './settings';
import { supabase } from './supabase';

const TICK_MS = 15_000;
const KEEP_DONE_MS = 24 * 60 * 60_000;
let running = false;
let rerun = false;

async function isOnline() {
  const state = await Network.getNetworkStateAsync();
  return !!state.isConnected && state.isInternetReachable !== false;
}

async function errorFromInvoke(error: unknown): Promise<SyncError> {
  const context = (error as { context?: Response }).context;
  const body = await context?.json().catch(() => null);
  return new SyncError(body?.error ?? (error as Error).message, context?.status);
}

function buildDeps(model: { id: 'small' | 'turbo'; path: string }): Deps {
  return {
    now: () => Date.now(),
    transcribeLocal: (uri) => transcribeLocal(uri, model),
    async uploadAudio(item) {
      const me = await getMe();
      const path = `${me.id}/${item.id}.wav`;
      const bytes = await new File(item.uri).bytes();
      const { error } = await supabase.storage.from('recordings').upload(path, bytes, { contentType: 'audio/wav', upsert: true });
      if (error) throw new SyncError(error.message, Number((error as { statusCode?: string }).statusCode) || undefined);
      return path;
    },
    async insertRecording(item, audioPath) {
      const me = await getMe();
      if (!me.team) throw new SyncError('Akun ini belum tergabung di tim', 400);
      const { error } = await supabase.from('recordings').insert({
        id: item.id,
        team_id: me.team.id,
        audio_path: audioPath,
        duration_ms: item.durationMs,
      });
      // 23505: sudah ada (retry) → anggap berhasil.
      if (error && error.code !== '23505') throw new SyncError(error.message, error.code === '23514' ? 400 : undefined);
    },
    async invoke(payload) {
      const { data, error } = await supabase.functions.invoke('transcribe', { body: payload });
      if (error) throw await errorFromInvoke(error);
      return { ideaId: data.idea_id as string };
    },
  };
}

// Mode cloud: item selesai cukup disimpan sehari. Mode lokal disimpan terus (audio hanya ada di HP).
async function pruneDone() {
  const cutoff = Date.now() - KEEP_DONE_MS;
  for (const item of await getQueue()) {
    if (item.stage === 'server_done' && item.mode === 'cloud' && item.createdAt < cutoff) await removeItem(item.id);
  }
}

// Proses semua item yang jatuh tempo. Aman dipanggil berkali-kali.
export async function runQueue(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    do {
      rerun = false;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const settings = await getSettings();
      const online = await isOnline();
      const model = { id: settings.model, path: modelPath(settings.model) };
      const modelReady = isModelAllowed(settings.model) && isModelReady(settings.model);
      const deps = buildDeps(model);
      await pruneDone();

      for (const item of await getQueue()) {
        if (!isDue(item, Date.now())) continue;
        const next = await processItem(item, { online, modelReady }, deps);
        if (next === item) continue;
        if (next.stage === 'server_done' && next.mode === 'cloud') {
          // Audio sudah aman di bucket; hapus salinan lokal (item disimpan sebentar untuk UI).
          const f = new File(next.uri);
          if (f.exists) f.delete();
        }
        await upsertItem(next);
        // Setelah draft lokal jadi, langsung coba sinkron di putaran yang sama.
        if (next.stage === 'local_transcribed' && online) rerun = true;
      }
    } while (rerun);
  } finally {
    running = false;
  }
}

export function useSyncRunner(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void runQueue();
    const app = AppState.addEventListener('change', (s) => s === 'active' && void runQueue());
    const net = Network.addNetworkStateListener(() => void runQueue());
    const timer = setInterval(() => void runQueue(), TICK_MS);
    return () => {
      app.remove();
      net.remove();
      clearInterval(timer);
    };
  }, [enabled]);
}
