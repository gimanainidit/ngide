import { describe, expect, it } from 'vitest';
import { chooseAction } from './policy';
import { newItem, onFailure, onLocalTranscribed, onSynced } from './queue';

const base = (mode: 'cloud' | 'local') => newItem({ id: 'r', uri: 'u', durationMs: 1000, now: 0, mode, polish: true });
const transcribed = (mode: 'cloud' | 'local') =>
  onLocalTranscribed(base(mode), { transcript: 't', model: 'm', title: 'x', body_md: 't' }, 0);
const cloudFailed = () => onFailure(base('cloud'), { permanent: false, message: 'x', cloud: true }, 0);

describe('chooseAction', () => {
  const cases: [string, ReturnType<typeof base>, { online: boolean; modelReady: boolean }, string][] = [
    ['cloud, online → sync', base('cloud'), { online: true, modelReady: true }, 'sync'],
    ['cloud, offline, model siap → lokal', base('cloud'), { online: false, modelReady: true }, 'transcribe_local'],
    ['cloud, offline, tanpa model → tunggu online', base('cloud'), { online: false, modelReady: false }, 'wait_online'],
    ['cloud gagal, online, model siap → draft lokal dulu', cloudFailed(), { online: true, modelReady: true }, 'transcribe_local'],
    ['cloud gagal, online, tanpa model → coba sync lagi', cloudFailed(), { online: true, modelReady: false }, 'sync'],
    ['cloud, draft lokal ada, online → sync (transkrip ulang di server)', transcribed('cloud'), { online: true, modelReady: true }, 'sync'],
    ['cloud, draft lokal ada, offline → tunggu', transcribed('cloud'), { online: false, modelReady: true }, 'wait_online'],
    ['lokal, model siap → lokal (walau online)', base('local'), { online: true, modelReady: true }, 'transcribe_local'],
    ['lokal, tanpa model → tunggu model', base('local'), { online: true, modelReady: false }, 'wait_model'],
    ['lokal, draft ada, online → sync teks', transcribed('local'), { online: true, modelReady: true }, 'sync'],
    ['lokal, draft ada, offline → tunggu', transcribed('local'), { online: false, modelReady: true }, 'wait_online'],
    ['selesai → tidak ada', onSynced(base('cloud'), 'i'), { online: true, modelReady: true }, 'none'],
    ['permanen → tidak ada', onFailure(base('cloud'), { permanent: true, message: 'x' }, 0), { online: true, modelReady: true }, 'none'],
  ];
  for (const [name, item, ctx, expected] of cases) {
    it(name, () => expect(chooseAction(item, ctx)).toBe(expected));
  }
});

import { describePending } from './policy';

describe('describePending', () => {
  const on = { online: true, modelReady: true };
  it('label sesuai keadaan', () => {
    expect(describePending(base('cloud'), on)).toBe('Mentranskrip…');
    expect(describePending(base('cloud'), { online: false, modelReady: false })).toBe('Menunggu sinyal');
    expect(describePending(base('local'), { online: true, modelReady: false })).toBe('Menunggu model diunduh');
    expect(describePending(cloudFailed(), on)).toBe('Gagal, dicoba lagi otomatis');
    expect(describePending(transcribed('cloud'), { online: false, modelReady: true })).toBe('Draft lokal · menunggu sinyal');
    expect(describePending(onFailure(base('cloud'), { permanent: true, message: 'Rekaman lebih dari 2 menit' }, 0), on)).toBe(
      'Gagal: Rekaman lebih dari 2 menit',
    );
  });
});
