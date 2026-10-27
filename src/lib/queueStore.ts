import type { QueueItem } from './queue';
import { createStore } from './store';

export type QueueItemList = QueueItem[];

function parseQueue(raw: string | null): QueueItem[] {
  try {
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const store = createStore<QueueItem[]>('ngide.queue.v1', parseQueue);

export const getQueue = store.get;
export const useQueue = () => store.useValue() ?? [];
export const subscribeQueue = store.subscribe;

export function upsertItem(item: QueueItem) {
  return store.update((items) => [item, ...items.filter((i) => i.id !== item.id)].sort((a, b) => b.createdAt - a.createdAt));
}

export function removeItem(id: string) {
  return store.update((items) => items.filter((i) => i.id !== id));
}

export async function getItem(id: string) {
  return (await store.get()).find((i) => i.id === id);
}
