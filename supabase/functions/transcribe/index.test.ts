import { beforeEach, describe, expect, it, vi } from 'vitest';

const REC_ID = '11111111-1111-4111-8111-111111111111';
type Call = { kind: 'user' | 'admin'; table: string; method: string; args: unknown[] };
const calls: Call[] = [];
let handler: (req: Request) => Promise<Response>;
let state: any;

// Builder palsu: hasil ditentukan oleh state.resolve(kind, table, metodePertama, argumenEq).
function makeFrom(kind: 'user' | 'admin') {
  return (table: string) => {
    let first = '';
    const eqs: unknown[][] = [];
    const proxy: any = new Proxy(() => {}, {
      get(_t, prop: string) {
        if (prop === 'then') return (res: (v: unknown) => void) => res(state.resolve(kind, table, first, eqs));
        return (...args: unknown[]) => {
          if (!first) first = prop;
          if (prop === 'eq') eqs.push(args);
          calls.push({ kind, table, method: prop, args });
          return proxy;
        };
      },
    });
    return proxy;
  };
}

vi.mock('jsr:@supabase/supabase-js@2', () => ({
  createClient: (_url: string, key: string) =>
    key === 'service'
      ? {
          from: makeFrom('admin'),
          storage: { from: () => ({ download: async () => state.download }) },
          rpc: async (_name: string, args: { p_secret: string }) => ({ data: args.p_secret === 'rahasia' }),
        }
      : { from: makeFrom('user'), auth: { getUser: async () => ({ data: { user: state.user } }) } },
}));

function defaultResolve(kind: string, table: string, first: string) {
  if (kind === 'user' && table === 'recordings' && first === 'select') return { data: state.rec, error: null };
  if (kind === 'admin' && table === 'ideas' && first === 'select') return { data: state.existingIdea, error: null };
  if (kind === 'admin' && table === 'ideas' && first === 'insert')
    return state.insertError ? { data: null, error: state.insertError } : { data: { id: 'idea-1' }, error: null };
  return { data: null, error: null };
}

const sttUrl = (u: string) => String(u).includes('/audio/transcriptions');
const chatUrl = (u: string) => String(u).includes('/chat/completions');
const sttOk = (text: string) => ({ ok: true, status: 200, json: async () => ({ text }) });
const chatOk = (title: string, body: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify({ title, body_md: body }) } }] }),
});
function mockFetch(stt: (n: number) => any, chat: () => any = () => ({ ok: false, status: 500 })) {
  let n = 0;
  globalThis.fetch = vi.fn(async (url: string) => (sttUrl(url) ? stt(n++) : chatUrl(url) ? chat() : { ok: false, status: 404 })) as any;
}

async function load() {
  vi.resetModules();
  (globalThis as any).Deno = { env: { get: (k: string) => state.env[k] }, serve: (h: typeof handler) => (handler = h) };
  await import('./index.ts');
}

const post = (body: unknown) => handler(new Request('http://x/transcribe', { method: 'POST', body: JSON.stringify(body) }));
const base = { recording_id: REC_ID };
const recUpdates = () => calls.filter((c) => c.kind === 'admin' && c.table === 'recordings' && c.method === 'update').map((c) => c.args[0] as any);
const ideaInsert = () => calls.find((c) => c.table === 'ideas' && c.method === 'insert')?.args[0] as any;
const fetchCalls = (pred: (u: string) => boolean) => (globalThis.fetch as any).mock.calls.filter((c: any[]) => pred(c[0]));

beforeEach(async () => {
  calls.length = 0;
  state = {
    user: { id: 'u1' },
    rec: { id: REC_ID, owner_id: 'u1', team_id: 't1', audio_path: `u1/${REC_ID}.wav`, duration_ms: 30_000, created_at: '2026-10-26T15:41:00Z' },
    existingIdea: null,
    download: { data: new Blob(['audio'], { type: 'audio/wav' }), error: null },
    insertError: null,
    env: { SUPABASE_URL: 'http://s', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', GROQ_API_KEY: 'gsk' },
    resolve: defaultResolve,
  };
  mockFetch(() => sttOk('Kita buat widget. Biar cepat rekam.'));
  await load();
});

describe('validasi', () => {
  it('tanpa login → 401', async () => {
    state.user = null;
    expect((await post(base)).status).toBe(401);
  });
  it('recording_id / mode / panjang teks tidak valid → 400', async () => {
    expect((await post({ recording_id: 'x' })).status).toBe(400);
    expect((await post({ ...base, mode: 'satelit' })).status).toBe(400);
    expect((await post({ ...base, local_transcript: 'a'.repeat(50_001) })).status).toBe(400);
  });
  it('rekaman bukan milik pemanggil → 404', async () => {
    state.rec = null;
    expect((await post(base)).status).toBe(404);
  });
  it('idempoten: draft sudah ada → kembalikan tanpa memanggil penyedia', async () => {
    state.existingIdea = { id: 'idea-lama' };
    expect(await (await post(base)).json()).toEqual({ idea_id: 'idea-lama' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('tiket 09: batas 2 menit', () => {
  it('durasi > 125 dtk → 413 tanpa memanggil penyedia', async () => {
    state.rec.duration_ms = 130_000;
    expect((await post(base)).status).toBe(413);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(recUpdates().at(-1)).toMatchObject({ status: 'failed' });
  });
  it('audio > 5 MB → 413', async () => {
    state.download = { data: { size: 6 * 1024 * 1024, type: 'audio/wav' }, error: null };
    expect((await post(base)).status).toBe(413);
  });
});

describe('mode cloud', () => {
  it('sukses + rapi: ide pakai versi rapi, sumber groq turbo, polish done', async () => {
    mockFetch(() => sttOk('eee buat widget'), () => chatOk('Widget cepat', '- Buat **widget**'));
    const res = await post(base);
    expect(await res.json()).toEqual({ idea_id: 'idea-1', transcript_source: 'groq', polish_status: 'done' });
    expect(ideaInsert()).toMatchObject({ title: 'Widget cepat', body_md: '- Buat **widget**', suggested_body_md: null });
    expect(recUpdates().at(-1)).toMatchObject({
      status: 'done',
      raw_transcript: 'eee buat widget',
      transcript_source: 'groq',
      stt_model: 'whisper-large-v3-turbo',
      polish_status: 'done',
    });
    const [, init] = fetchCalls(sttUrl)[0];
    expect((init.body as FormData).get('language')).toBe('id');
  });

  it('turbo 503 → whisper-large-v3 dipakai', async () => {
    mockFetch((n) => (n === 0 ? { ok: false, status: 503 } : sttOk('Halo.')));
    await post(base);
    expect(recUpdates().at(-1)).toMatchObject({ stt_model: 'whisper-large-v3' });
  });

  it('transkrip ulang: transkrip cloud menggantikan transkrip lokal', async () => {
    mockFetch(() => sttOk('Versi cloud.'));
    await post({ ...base, local_transcript: 'versi lokal', local_model: 'small-q5_1' });
    expect(recUpdates().at(-1)).toMatchObject({ raw_transcript: 'Versi cloud.', transcript_source: 'groq' });
  });

  it('semua penyedia gagal + ada transkrip lokal → ide tetap dibuat dari transkrip lokal', async () => {
    mockFetch(() => ({ ok: false, status: 503 }));
    const res = await post({ ...base, local_transcript: 'Ide dari HP.', local_model: 'small-q5_1' });
    expect(res.status).toBe(200);
    expect(recUpdates().at(-1)).toMatchObject({ transcript_source: 'local-whisper', stt_model: 'small-q5_1', polish_status: 'pending' });
    expect(ideaInsert()).toMatchObject({ body_md: 'Ide dari HP.' });
  });

  it('semua gagal tanpa transkrip lokal → 502 (bisa dicoba ulang)', async () => {
    mockFetch(() => ({ ok: false, status: 503 }));
    expect((await post(base)).status).toBe(502);
    expect(recUpdates().at(-1)).toMatchObject({ status: 'failed' });
  });

  it('audio ditolak (400) → 422 permanen, provider lain tidak dicoba', async () => {
    mockFetch(() => ({ ok: false, status: 400 }));
    expect((await post(base)).status).toBe(422);
    expect(fetchCalls(sttUrl)).toHaveLength(1);
  });

  it('GROQ_API_KEY tidak ada + ada transkrip lokal → tetap jadi ide', async () => {
    state.env.GROQ_API_KEY = undefined;
    const res = await post({ ...base, local_transcript: 'Dari HP.' });
    expect(res.status).toBe(200);
    expect(recUpdates().at(-1)).toMatchObject({ transcript_source: 'local-whisper', polish_status: 'pending' });
  });

  it('audio belum ter-upload → 409', async () => {
    state.download = { data: null, error: new Error('not found') };
    expect((await post(base)).status).toBe(409);
  });

  it('perapian gagal → transkrip mentah, polish pending', async () => {
    const res = await post(base);
    expect((await res.json()).polish_status).toBe('pending');
    expect(ideaInsert()).toMatchObject({ title: 'Ide 26 Okt 22.41', body_md: 'Kita buat widget. Biar cepat rekam.' });
  });

  it('balapan insert → ambil draft pemenang', async () => {
    state.insertError = { code: '23505' };
    let n = 0;
    state.resolve = (kind: string, table: string, first: string, eqs: unknown[][]) =>
      kind === 'admin' && table === 'ideas' && first === 'select'
        ? { data: n++ === 0 ? null : { id: 'idea-pemenang' }, error: null }
        : defaultResolve(kind, table, first);
    expect(await (await post(base)).json()).toEqual({ idea_id: 'idea-pemenang' });
  });
});

describe('mode selalu lokal', () => {
  beforeEach(() => {
    state.rec.audio_path = null;
  });

  it('tidak mengunduh audio dan tidak memanggil STT', async () => {
    mockFetch(() => sttOk('tidak boleh'), () => chatOk('Rapi', '- rapi'));
    const res = await post({ ...base, mode: 'local', local_transcript: 'Ide lokal.', local_model: 'small-q5_1' });
    expect(res.status).toBe(200);
    expect(fetchCalls(sttUrl)).toHaveLength(0);
    expect(recUpdates().at(-1)).toMatchObject({ transcript_source: 'local-whisper', stt_model: 'small-q5_1', polish_status: 'done' });
  });

  it('draft sudah diedit → editan dipakai, versi rapi jadi saran', async () => {
    mockFetch(() => sttOk('x'), () => chatOk('Rapi', '- rapi'));
    await post({
      ...base,
      mode: 'local',
      local_transcript: 'Ide lokal.',
      local_edited: true,
      local_title: 'Judulku',
      local_body: 'Editanku',
    });
    expect(ideaInsert()).toMatchObject({ title: 'Judulku', body_md: 'Editanku', suggested_title: 'Rapi', suggested_body_md: '- rapi' });
    expect(recUpdates().at(-1)).toMatchObject({ polish_status: 'suggested' });
  });

  it('perapian dimatikan → LLM tidak dipanggil, skipped', async () => {
    await post({ ...base, mode: 'local', local_transcript: 'Ide lokal.', polish: false });
    expect(fetchCalls(chatUrl)).toHaveLength(0);
    expect(recUpdates().at(-1)).toMatchObject({ polish_status: 'skipped' });
  });

  it('transkrip lokal kosong → 422', async () => {
    expect((await post({ ...base, mode: 'local', local_transcript: '  ' })).status).toBe(422);
  });
});

describe('tiket 14: polish_pending', () => {
  it('secret salah → 401', async () => {
    expect((await post({ action: 'polish_pending', secret: 'salah' })).status).toBe(401);
    expect((await post({ action: 'polish_pending' })).status).toBe(401);
  });

  it('timpa draft yang belum disentuh, saran untuk yang diedit, menyerah setelah 5 kali', async () => {
    const recs = [
      { id: 'r1', raw_transcript: 'satu', polish_attempts: 0 },
      { id: 'r2', raw_transcript: 'dua', polish_attempts: 0 },
      { id: 'r3', raw_transcript: 'tiga', polish_attempts: 4 },
    ];
    const ideas: Record<string, any> = {
      r1: { id: 'i1', status: 'draft', updated_by: null },
      r2: { id: 'i2', status: 'draft', updated_by: 'u1' },
      r3: { id: 'i3', status: 'draft', updated_by: null },
    };
    state.resolve = (kind: string, table: string, first: string, eqs: unknown[][]) => {
      if (kind === 'admin' && table === 'recordings' && first === 'select') return { data: recs, error: null };
      if (kind === 'admin' && table === 'ideas' && first === 'select') return { data: ideas[eqs[0][1] as string], error: null };
      return { data: null, error: null };
    };
    globalThis.fetch = vi.fn(async (_u: string, init: any) => {
      const user = JSON.parse(init.body).messages[1].content;
      return user === 'tiga' ? { ok: false, status: 500 } : chatOk(`Rapi ${user}`, `- ${user}`);
    }) as any;

    expect(await (await post({ action: 'polish_pending', secret: 'rahasia' })).json()).toEqual({ processed: 3 });
    const ideaUpdates = calls.filter((c) => c.table === 'ideas' && c.method === 'update').map((c) => c.args[0]);
    expect(ideaUpdates).toEqual([
      { title: 'Rapi satu', body_md: '- satu' },
      { suggested_title: 'Rapi dua', suggested_body_md: '- dua' },
    ]);
    expect(recUpdates()).toEqual([
      { polish_status: 'done', polish_attempts: 1 },
      { polish_status: 'suggested', polish_attempts: 1 },
      { polish_status: 'skipped', polish_attempts: 5 },
    ]);
  });
});
