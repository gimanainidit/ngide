import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRD_SECTIONS } from './standardize.ts';

const PRD_ID = '22222222-2222-4222-8222-222222222222';
let handler: (req: Request) => Promise<Response>;
let state: any;

function from(table: string) {
  const result = () =>
    table === 'prds' ? { data: state.prd, error: null } : { data: state.excerpts, error: null };
  const proxy: any = new Proxy(() => {}, {
    get(_t, prop: string) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(result());
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock('jsr:@supabase/supabase-js@2', () => ({
  createClient: () => ({ from, auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));

const full = PRD_SECTIONS.map((s) => `## ${s}\nisi`).join('\n\n');
const chat = (content: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
const post = (body: unknown) => handler(new Request('http://x/prd', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(async () => {
  state = {
    user: { id: 'u1' },
    prd: { id: PRD_ID, title: 'Widget', body_md: 'catatan' },
    excerpts: [{ quote_md: 'buat widget', idea: { author: { display_name: 'Andi', email: 'a@x' } } }],
    env: { SUPABASE_URL: 'http://s', SUPABASE_ANON_KEY: 'anon', GROQ_API_KEY: 'gsk' },
  };
  globalThis.fetch = vi.fn(async () => chat(JSON.stringify({ markdown: full }))) as any;
  vi.resetModules();
  (globalThis as any).Deno = { env: { get: (k: string) => state.env[k] }, serve: (h: typeof handler) => (handler = h) };
  await import('./index.ts');
});

describe('prd standardize', () => {
  it('sukses → markdown 5 bagian, prompt memuat kutipan', async () => {
    const res = await post({ action: 'standardize', prd_id: PRD_ID });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ markdown: full });
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.model).toBe('openai/gpt-oss-120b');
    expect(body.messages[1].content).toContain('buat widget');
    expect(body.messages[1].content).toContain('Andi');
  });
  it('tanpa login → 401', async () => {
    state.user = null;
    expect((await post({ action: 'standardize', prd_id: PRD_ID })).status).toBe(401);
  });
  it('aksi / id tidak valid → 400', async () => {
    expect((await post({ action: 'hapus', prd_id: PRD_ID })).status).toBe(400);
    expect((await post({ action: 'standardize', prd_id: 'x' })).status).toBe(400);
  });
  it('PRD tidak terlihat (RLS) → 404', async () => {
    state.prd = null;
    expect((await post({ action: 'standardize', prd_id: PRD_ID })).status).toBe(404);
  });
  it('PRD kosong tanpa kutipan → 422 tanpa memanggil LLM', async () => {
    state.prd.body_md = '  ';
    state.excerpts = [];
    expect((await post({ action: 'standardize', prd_id: PRD_ID })).status).toBe(422);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('kunci Groq belum ada → 503', async () => {
    state.env.GROQ_API_KEY = undefined;
    expect((await post({ action: 'standardize', prd_id: PRD_ID })).status).toBe(503);
  });
  it('LLM error atau format salah → 502', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any;
    expect((await post({ action: 'standardize', prd_id: PRD_ID })).status).toBe(502);
    globalThis.fetch = vi.fn(async () => chat(JSON.stringify({ markdown: '## Latar masalah\nsaja' }))) as any;
    expect((await post({ action: 'standardize', prd_id: PRD_ID })).status).toBe(502);
  });
});
