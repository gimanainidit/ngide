import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settingsCore';
import { createStore } from './store';

const store = createStore<Settings>('ngide.settings.v1', parseSettings);

export const getSettings = store.get;
export const updateSettings = (patch: Partial<Settings>) => store.update((s) => ({ ...s, ...patch }));
export const useSettings = () => store.useValue() ?? DEFAULT_SETTINGS;
