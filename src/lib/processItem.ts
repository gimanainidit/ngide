import { buildIdea } from '../../supabase/functions/transcribe/markdown';
import { chooseAction } from './policy';
import { classifyError, isDue, onFailure, onLocalTranscribed, onSynced, type QueueItem } from './queue';

export class SyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type InvokePayload = {
  recording_id: string;
  mode: 'cloud' | 'local';
  polish: boolean;
  local_transcript?: string;
  local_model?: string;
  local_title?: string;
  local_body?: string;
  local_edited?: boolean;
};

export type Deps = {
  now(): number;
  transcribeLocal(uri: string): Promise<{ text: string; model: string }>;
  uploadAudio(item: QueueItem): Promise<string>;
  insertRecording(item: QueueItem, audioPath: string | null): Promise<void>;
  invoke(payload: InvokePayload): Promise<{ ideaId: string }>;
};

// Jalankan satu langkah untuk satu item. Tidak pernah melempar: kegagalan dicatat di item.
export async function processItem(item: QueueItem, ctx: { online: boolean; modelReady: boolean }, deps: Deps): Promise<QueueItem> {
  if (!isDue(item, deps.now())) return item;
  const action = chooseAction(item, ctx);

  if (action === 'transcribe_local') {
    try {
      const { text, model } = await deps.transcribeLocal(item.uri);
      const draft = buildIdea(text, new Date(item.createdAt));
      if (!draft) {
        // Mode cloud masih bisa mencoba cloud; mode lokal tidak punya jalan lain.
        return item.mode === 'local'
          ? onFailure(item, { permanent: true, message: 'Tidak ada suara terdeteksi' }, deps.now())
          : onFailure(item, { permanent: false, message: 'Transkrip lokal kosong' }, deps.now());
      }
      return onLocalTranscribed(item, { transcript: text, model, ...draft }, deps.now());
    } catch (e) {
      return onFailure(item, { permanent: false, message: e instanceof Error ? e.message : 'Transkripsi lokal gagal' }, deps.now());
    }
  }

  if (action !== 'sync') return item;

  let current = item;
  try {
    if (current.mode === 'cloud' && !current.uploaded) {
      const audioPath = await deps.uploadAudio(current);
      current = { ...current, uploaded: true, audioPath };
    }
    if (!current.inserted) {
      // Mode lokal tidak pernah mengunggah audio.
      await deps.insertRecording(current, current.mode === 'cloud' ? current.audioPath ?? null : null);
      current = { ...current, inserted: true };
    }

    const payload: InvokePayload = { recording_id: current.id, mode: current.mode, polish: current.polish };
    if (current.local) {
      payload.local_transcript = current.local.transcript;
      payload.local_model = current.local.model;
      if (current.local.edited) {
        payload.local_title = current.local.title;
        payload.local_body = current.local.body_md;
        payload.local_edited = true;
      }
    }
    const { ideaId } = await deps.invoke(payload);
    return onSynced(current, ideaId);
  } catch (e) {
    const status = e instanceof SyncError ? e.status : undefined;
    const message = e instanceof Error ? e.message : 'Sinkronisasi gagal';
    const kind = classifyError(status);
    if (kind === 'reupload') current = { ...current, uploaded: false };
    return onFailure(current, { permanent: kind === 'permanent', message, cloud: true }, deps.now());
  }
}
