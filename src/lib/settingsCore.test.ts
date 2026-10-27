import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settingsCore';

describe('parseSettings', () => {
  it('kosong / rusak → default', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{rusak')).toEqual(DEFAULT_SETTINGS);
  });
  it('nilai valid dipertahankan', () => {
    expect(parseSettings('{"mode":"local","polish":false,"model":"turbo"}')).toEqual({ mode: 'local', polish: false, model: 'turbo' });
  });
  it('nilai asing kembali ke default', () => {
    expect(parseSettings('{"mode":"satelit","polish":"ya","model":"huge"}')).toEqual(DEFAULT_SETTINGS);
  });
});
