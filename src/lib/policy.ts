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
