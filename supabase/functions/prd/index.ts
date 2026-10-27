import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildStandardizeMessages, parseStandardized } from './standardize.ts';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const env = (key: string) => Deno.env.get(key);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Menyusun PRD standar dari isi PRD + kutipan. Hanya mengembalikan pratinjau; tidak menulis ke database.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const userClient = createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Belum login' }, 401);

  const body = await req.json().catch(() => null);
  if (body?.action !== 'standardize' || typeof body.prd_id !== 'string' || !UUID.test(body.prd_id)) {
    return json({ error: 'Permintaan tidak valid' }, 400);
  }

  // RLS: hanya anggota tim pemilik PRD yang bisa membacanya.
  const { data: prd } = await userClient.from('prds').select('id,title,body_md').eq('id', body.prd_id).maybeSingle();
  if (!prd) return json({ error: 'PRD tidak ditemukan' }, 404);
  const { data: excerpts } = await userClient
    .from('prd_excerpts')
    .select('quote_md,idea:ideas(author:profiles!ideas_author_id_fkey(display_name,email))')
    .eq('prd_id', prd.id)
    .order('position')
    .order('created_at');

  const items = (excerpts ?? []).map((e: any) => ({
    quote_md: e.quote_md as string,
    author: e.idea?.author?.display_name ?? e.idea?.author?.email ?? 'Anggota',
  }));
  if (!prd.body_md.trim() && items.length === 0) return json({ error: 'PRD masih kosong. Tulis catatan atau kutip ide dulu.' }, 422);

  const key = env('GROQ_API_KEY');
  if (!key) return json({ error: 'Layanan AI belum dikonfigurasi' }, 503);

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env('GROQ_PRD_MODEL') ?? DEFAULT_MODEL,
        messages: buildStandardizeMessages({ title: prd.title, body_md: prd.body_md, excerpts: items }),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return json({ error: `AI gagal (${res.status}), coba lagi` }, 502);
    const data = await res.json();
    const markdown = parseStandardized(data?.choices?.[0]?.message?.content);
    if (!markdown) return json({ error: 'Hasil AI tidak sesuai format, coba lagi' }, 502);
    return json({ markdown });
  } catch {
    return json({ error: 'AI tidak merespons, coba lagi' }, 502);
  }
});
