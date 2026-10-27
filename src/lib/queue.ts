// State machine antrean rekaman. Pure.
export type Mode = 'cloud' | 'local';
export type Stage = 'recorded' | 'local_transcribed' | 'server_done' | 'failed_permanent';

export type LocalDraft = { transcript: string; model: string; title: string; body_md: string; edited: boolean };

export type QueueItem = {
  id: string; // = recording_id di server
  uri: string; // WAV 16 kHz mono di direktori dokumen
  durationMs: number;
  createdAt: number;
  mode: Mode;
  polish: boolean;
  stage: Stage;
  uploaded: boolean;
  audioPath?: string; // path di bucket, diisi setelah upload pertama
  inserted: boolean;
  cloudFailures: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  local?: LocalDraft;
  ideaId?: string;
};

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 10 * 60_000;

export function newItem(p: { id: string; uri: string; durationMs: number; now: number; mode: Mode; polish: boolean }): QueueItem {
  return {
    id: p.id,
    uri: p.uri,
    durationMs: p.durationMs,
    createdAt: p.now,
    mode: p.mode,
    polish: p.polish,
    stage: 'recorded',
    uploaded: false,
    inserted: false,
    cloudFailures: 0,
    attempts: 0,
    nextAttemptAt: p.now,
  };
}

export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

export function isDue(item: QueueItem, now: number): boolean {
  return (item.stage === 'recorded' || item.stage === 'local_transcribed') && item.nextAttemptAt <= now;
}

export function onLocalTranscribed(item: QueueItem, draft: Omit<LocalDraft, 'edited'>, now: number): QueueItem {
  return { ...item, stage: 'local_transcribed', local: { ...draft, edited: false }, attempts: 0, nextAttemptAt: now, lastError: undefined };
}

export function editLocalDraft(item: QueueItem, title: string, body_md: string): QueueItem {
  if (item.stage !== 'local_transcribed' || !item.local) return item;
  return { ...item, local: { ...item.local, title, body_md, edited: true } };
}

export function onSynced(item: QueueItem, ideaId: string): QueueItem {
  return { ...item, stage: 'server_done', ideaId, lastError: undefined };
}

export function onFailure(item: QueueItem, error: { permanent: boolean; message: string; cloud?: boolean }, now: number): QueueItem {
  if (error.permanent) return { ...item, stage: 'failed_permanent', lastError: error.message };
  const attempts = item.attempts + 1;
  return {
    ...item,
    attempts,
    nextAttemptAt: now + backoffMs(attempts),
    lastError: error.message,
    cloudFailures: item.cloudFailures + (error.cloud ? 1 : 0),
  };
}

// Status HTTP dari Edge Function / Storage → cara menangani di klien.
export function classifyError(status: number | undefined): 'permanent' | 'retryable' | 'reupload' {
  if (status === 409) return 'reupload';
  if (status !== undefined && [400, 404, 413, 415, 422].includes(status)) return 'permanent';
  return 'retryable';
}
