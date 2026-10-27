import type { QueueItem } from './queue';

export type Action = 'none' | 'sync' | 'transcribe_local' | 'wait_online' | 'wait_model';

// Pilih langkah berikutnya untuk satu rekaman. Pure.
export function chooseAction(item: QueueItem, ctx: { online: boolean; modelReady: boolean }): Action {
  if (item.stage === 'server_done' || item.stage === 'failed_permanent') return 'none';

  if (item.stage === 'local_transcribed') return ctx.online ? 'sync' : 'wait_online';

  if (item.mode === 'local') return ctx.modelReady ? 'transcribe_local' : 'wait_model';

  // Mode cloud + cadangan lokal.
  if (ctx.online && item.cloudFailures === 0) return 'sync';
  if (ctx.modelReady) return 'transcribe_local';
  return ctx.online ? 'sync' : 'wait_online';
}

// Label status untuk daftar "Belum tersinkron". Pure.
export function describePending(item: QueueItem, ctx: { online: boolean; modelReady: boolean }): string {
  if (item.stage === 'failed_permanent') return `Gagal: ${item.lastError ?? 'tidak diketahui'}`;
  if (item.stage === 'local_transcribed') {
    return ctx.online ? 'Draft lokal · menyinkronkan' : 'Draft lokal · menunggu sinyal';
  }
  if (item.stage !== 'recorded') return '';
  if (item.mode === 'local' && !ctx.modelReady) return 'Menunggu model diunduh';
  if (!ctx.online && !ctx.modelReady) return 'Menunggu sinyal';
  if (item.lastError) return 'Gagal, dicoba lagi otomatis';
  return 'Mentranskrip…';
}
