import { beforeEach, describe, expect, it, vi } from 'vitest';

const REC_ID = '11111111-1111-4111-8111-111111111111';
const calls: { table: string; method: string; args: unknown[] }[] = [];
let handler: (req: Request) => Promise<Response>;
let state: {
  user: unknown;
  rec: unknown;
  existingIdea: unknown;
  download: unknown;
  insertError: unknown;
  env: Record<string, string | undefined>;
};

// Builder palsu: method pertama di tabel menentukan hasil; await/maybeSingle/single mengembalikan hasil itu.
function from(table: string) {
  let first = '';
  const result = () => {
    if (table === 'recordings' && first === 'select') return { data: state.rec, error: null };
    if (table === 'ideas' && first === 'select') return { data: state.existingIdea, error: null };
    if (table === 'ideas' && first === 'insert')
      return state.insertError ? { data: null, error: state.insertError } : { data: { id: 'idea-1' }, error: null };
    return { data: null, error: null };
  };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop: string) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(result());
      return (...args: unknown[]) => {
        if (!first) first = prop;
        calls.push({ table, method: prop, args });
        return proxy;
      };
    },
  });
  return proxy;
}

vi.mock('jsr:@supabase/supabase-js@2', () => ({
  createClient: (_url: string, key: string) =>
    key === 'service'
      ? { from, storage: { from: () => ({ download: async () => state.download }) } }
      : { from, auth: { getUser: async () => ({ data: { user: state.user } }) } },
}));

async function load() {
  vi.resetModules();
  (globalThis as any).Deno = {
    env: { get: (k: string) => state.env[k] },
    serve: (h: typeof handler) => (handler = h),
  };
  await import('./index.ts');
}

const post = (body: unknown = { recording_id: REC_ID }) =>
  handler(new Request('http://x/transcribe', { method: 'POST', body: JSON.stringify(body) }));
const updatesTo = (status: string) =>
  calls.filter((c) => c.table === 'recordings' && c.method === 'update' && (c.args[0] as any).status === status);

beforeEach(async () => {
  calls.length = 0;
  state = {
    user: { id: 'u1' },
    rec: { id: REC_ID, owner_id: 'u1', team_id: 't1', audio_path: `u1/${REC_ID}.m4a`, created_at: '2026-10-26T15:41:00Z' },
    existingIdea: null,
    download: { data: new Blob(['audio'], { type: 'audio/mp4' }), error: null },
    insertError: null,
    env: { SUPABASE_URL: 'http://s', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', GROQ_API_KEY: 'gsk_test' },
  };
  globalThis.fetch = vi.fn(async (url: string) =>
    String(url).includes('chat/completions')
      ? { ok: false, status: 500 } // default: LLM gagal → fallback mentah
      : { ok: true, status: 200, json: async () => ({ text: 'Kita buat widget. Biar cepat rekam.' }) },
  ) as any;
  await load();
});

describe('transcribe', () => {
  it('alur sukses: Groq dipanggil, rekaman done, draft dibuat', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ idea_id: 'idea-1' });

    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toContain('api.groq.com/openai/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer gsk_test');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect(form.get('language')).toBe('id');

    expect(updatesTo('done')[0].args[0]).toMatchObject({ raw_transcript: 'Kita buat widget. Biar cepat rekam.' });
    const insert = calls.find((c) => c.table === 'ideas' && c.method === 'insert')!;
    expect(insert.args[0]).toMatchObject({
      team_id: 't1',
      author_id: 'u1',
      recording_id: REC_ID,
      title: 'Ide 26 Okt 22.41',
      body_md: 'Kita buat widget. Biar cepat rekam.',
    });
  });

  it('LLM berhasil: judul dan body dari hasil rapi, transkrip mentah tetap disimpan', async () => {
    globalThis.fetch = vi.fn(async (url: string) =>
      String(url).includes('chat/completions')
        ? { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"title":"Widget cepat rekam","body_md":"- Buat **widget** rekam cepat"}' } }] }) }
        : { ok: true, status: 200, json: async () => ({ text: 'eee kita buat widget biar cepat rekam' }) },
    ) as any;
    expect((await post()).status).toBe(200);
    const chat = (globalThis.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('chat/completions'));
    expect(JSON.parse(chat[1].body)).toMatchObject({ model: 'openai/gpt-oss-20b', response_format: { type: 'json_object' } });
    expect(updatesTo('done')[0].args[0]).toMatchObject({ raw_transcript: 'eee kita buat widget biar cepat rekam' });
    const insert = calls.find((c) => c.table === 'ideas' && c.method === 'insert')!;
    expect(insert.args[0]).toMatchObject({ title: 'Widget cepat rekam', body_md: '- Buat **widget** rekam cepat' });
  });

  it('LLM balas sampah → fallback ke transkrip mentah', async () => {
    globalThis.fetch = vi.fn(async (url: string) =>
      String(url).includes('chat/completions')
        ? { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'maaf saya tidak bisa' } }] }) }
        : { ok: true, status: 200, json: async () => ({ text: 'Kita buat widget. Biar cepat rekam.' }) },
    ) as any;
    expect((await post()).status).toBe(200);
    const insert = calls.find((c) => c.table === 'ideas' && c.method === 'insert')!;
    expect(insert.args[0]).toMatchObject({ title: 'Ide 26 Okt 22.41', body_md: 'Kita buat widget. Biar cepat rekam.' });
  });

  it('idempoten: draft sudah ada → kembalikan tanpa memanggil Groq', async () => {
    state.existingIdea = { id: 'idea-lama' };
    const res = await post();
    expect(await res.json()).toEqual({ idea_id: 'idea-lama' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('tanpa login → 401', async () => {
    state.user = null;
    expect((await post()).status).toBe(401);
  });

  it('recording_id bukan UUID → 400', async () => {
    expect((await post({ recording_id: 'x' })).status).toBe(400);
  });

  it('rekaman bukan milik pemanggil (RLS kosong) → 404', async () => {
    state.rec = null;
    expect((await post()).status).toBe(404);
  });

  it('GROQ_API_KEY belum di-set → 500 dan rekaman tidak ditandai gagal', async () => {
    state.env.GROQ_API_KEY = undefined;
    const res = await post();
    expect(res.status).toBe(500);
    expect(updatesTo('failed')).toHaveLength(0);
  });

  it('Groq error → 502 dan rekaman failed (bisa dicoba ulang)', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 429 })) as any; // transkripsi & chat sama-sama gagal
    const res = await post();
    expect(res.status).toBe(502);
    expect(updatesTo('failed')).toHaveLength(1);
  });

  it('transkrip kosong → 422, tidak ada draft', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: '  ' }) })) as any;
    const res = await post();
    expect(res.status).toBe(422);
    expect(calls.some((c) => c.table === 'ideas' && c.method === 'insert')).toBe(false);
  });

  it('audio belum ter-upload → 409 dan failed', async () => {
    state.download = { data: null, error: new Error('not found') };
    expect((await post()).status).toBe(409);
    expect(updatesTo('failed')).toHaveLength(1);
  });

  it('balapan insert: unique index menolak, ambil draft yang sudah ada', async () => {
    state.insertError = { code: '23505' };
    // setelah insert gagal, select kedua menemukan draft pemenang
    let n = 0;
    Object.defineProperty(state, 'existingIdea', { get: () => (n++ === 0 ? null : { id: 'idea-pemenang' }), configurable: true });
    const res = await post();
    expect(await res.json()).toEqual({ idea_id: 'idea-pemenang' });
  });
});
