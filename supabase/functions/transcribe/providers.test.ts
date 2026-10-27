import { describe, expect, it, vi } from 'vitest';
import { classifyStatus, parseProviders, transcribeWithFallback } from './providers.ts';

const env = (vars: Record<string, string>) => (k: string) => vars[k];
const audio = new Blob(['x'], { type: 'audio/wav' });
const opts = { language: 'id', prompt: 'p', fileName: 'r.wav' };
const ok = (text: string) => ({ ok: true, status: 200, json: async () => ({ text }) });

describe('parseProviders', () => {
  it('default: dua model Groq bila GROQ_API_KEY ada', () => {
    expect(parseProviders(env({ GROQ_API_KEY: 'g' })).map((p) => p.model)).toEqual(['whisper-large-v3-turbo', 'whisper-large-v3']);
  });
  it('urutan dari STT_PROVIDERS, provider tanpa kunci dilewati, id asing diabaikan', () => {
    const list = parseProviders(env({ STT_PROVIDERS: 'openai, groq-turbo, ngawur', GROQ_API_KEY: 'g' }));
    expect(list.map((p) => p.id)).toEqual(['groq-turbo']);
  });
  it('openai aktif bila kuncinya ada', () => {
    const list = parseProviders(env({ STT_PROVIDERS: 'groq-turbo,openai', GROQ_API_KEY: 'g', OPENAI_API_KEY: 'o' }));
    expect(list.map((p) => p.source)).toEqual(['groq', 'openai']);
  });
  it('tanpa kunci apa pun → kosong', () => {
    expect(parseProviders(env({}))).toEqual([]);
  });
});

describe('classifyStatus', () => {
  it('masalah audio menghentikan rantai', () => {
    for (const s of [400, 413, 415, 422]) expect(classifyStatus(s)).toBe('audio');
  });
  it('masalah kunci/akses provider → coba provider lain', () => {
    for (const s of [401, 403, 404]) expect(classifyStatus(s)).toBe('provider');
  });
  it('sementara → coba provider lain', () => {
    for (const s of [408, 429, 500, 503]) expect(classifyStatus(s)).toBe('transient');
  });
});

describe('transcribeWithFallback', () => {
  const providers = parseProviders(env({ STT_PROVIDERS: 'groq-turbo,groq-large,openai', GROQ_API_KEY: 'g', OPENAI_API_KEY: 'o' }));

  it('provider pertama sukses', async () => {
    const fetchFn = vi.fn(async () => ok('halo'));
    const out = await transcribeWithFallback(providers, audio, opts, fetchFn as any);
    expect(out).toEqual({ ok: true, text: 'halo', source: 'groq', model: 'whisper-large-v3-turbo' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('429 lalu 401 → provider ketiga dipakai', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce(ok('dari openai'));
    const out = await transcribeWithFallback(providers, audio, opts, fetchFn as any);
    expect(out).toMatchObject({ ok: true, source: 'openai', model: 'gpt-4o-mini-transcribe' });
    const [, init] = fetchFn.mock.calls[2];
    expect(init.headers.Authorization).toBe('Bearer o');
  });

  it('error jaringan dianggap sementara', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(ok('ok'));
    expect(await transcribeWithFallback(providers, audio, opts, fetchFn as any)).toMatchObject({ ok: true, model: 'whisper-large-v3' });
  });

  it('400 (audio rusak) berhenti tanpa mencoba provider lain, permanen', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 400 }));
    const out = await transcribeWithFallback(providers, audio, opts, fetchFn as any);
    expect(out).toEqual({ ok: false, permanent: true, message: 'Audio ditolak penyedia transkripsi (400)' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('semua gagal sementara → tidak permanen', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 503 }));
    expect(await transcribeWithFallback(providers, audio, opts, fetchFn as any)).toMatchObject({ ok: false, permanent: false });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('tanpa provider → tidak permanen', async () => {
    expect(await transcribeWithFallback([], audio, opts, vi.fn() as any)).toEqual({
      ok: false,
      permanent: false,
      message: 'Tidak ada penyedia transkripsi yang dikonfigurasi',
    });
  });
});
