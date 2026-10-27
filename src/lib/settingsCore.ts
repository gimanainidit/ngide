import type { ModelId } from './models';
import type { Mode } from './queue';

export type Settings = { mode: Mode; polish: boolean; model: ModelId };

export const DEFAULT_SETTINGS: Settings = { mode: 'cloud', polish: true, model: 'small' };

// Toleran terhadap data lama/rusak: nilai yang tidak dikenal kembali ke default.
export function parseSettings(raw: string | null): Settings {
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return DEFAULT_SETTINGS;
  }
  return {
    mode: data.mode === 'local' ? 'local' : 'cloud',
    polish: typeof data.polish === 'boolean' ? data.polish : DEFAULT_SETTINGS.polish,
    model: data.model === 'turbo' ? 'turbo' : 'small',
  };
}
