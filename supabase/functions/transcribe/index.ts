import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildIdea, buildPolishMessages, parsePolished } from './markdown.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'whisper-large-v3-turbo';
const DEFAULT_CHAT_MODEL = 'openai/gpt-oss-20b';
const PROMPT =
  'Catatan ide pribadi dalam Bahasa Indonesia, kadang bercampur istilah English seperti app, feature, deadline, user.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function polish(transcript: string, groqKey: string) {
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_CHAT_MODEL') ?? DEFAULT_CHAT_MODEL,
        messages: buildPolishMessages(transcript),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parsePolished(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Belum login' }, 401);

  const payload = await req.json().catch(() => null);
  const recordingId = payload?.recording_id;
  if (typeof recordingId !== 'string' || !UUID.test(recordingId)) {
    return json({ error: 'recording_id tidak valid' }, 400);
  }

  // RLS: hanya pemilik rekaman yang bisa membacanya.
  const { data: rec } = await userClient.from('recordings').select('*').eq('id', recordingId).maybeSingle();
  if (!rec) return json({ error: 'Rekaman tidak ditemukan' }, 404);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Idempoten: kalau draft sudah ada (retry dari klien), kembalikan saja.
  const existing = await admin.from('ideas').select('id').eq('recording_id', recordingId).maybeSingle();
  if (existing.data) return json({ idea_id: existing.data.id });

  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) return json({ error: 'GROQ_API_KEY belum di-set di server' }, 500);

  await admin.from('recordings').update({ status: 'transcribing', error: null }).eq('id', recordingId);

  const fail = async (message: string, status: number) => {
    await admin.from('recordings').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', recordingId);
    return json({ error: message }, status);
  };

  const { data: file, error: downloadError } = await admin.storage.from('recordings').download(rec.audio_path);
  if (downloadError || !file) return fail('Audio belum ter-upload', 409);

  const form = new FormData();
  form.append('file', new File([file], 'rekaman.m4a', { type: file.type || 'audio/mp4' }));
  form.append('model', GROQ_MODEL);
  form.append('language', 'id');
  form.append('prompt', PROMPT);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const groq = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!groq.ok) return fail(`Transkripsi gagal (${groq.status})`, 502);

  const { text } = await groq.json();
  const raw = buildIdea(String(text ?? ''), new Date(rec.created_at));
  if (!raw) return fail('Tidak ada suara terdeteksi', 422);

  // Rapikan dengan LLM; kalau gagal apa pun, pakai transkrip mentah supaya ide tidak hilang.
  const idea = (await polish(String(text), groqKey)) ?? raw;

  await admin.from('recordings').update({ status: 'done', raw_transcript: text, error: null }).eq('id', recordingId);

  const inserted = await admin
    .from('ideas')
    .insert({ team_id: rec.team_id, author_id: rec.owner_id, recording_id: recordingId, ...idea })
    .select('id')
    .single();

  if (inserted.error) {
    // Balapan dua request: unique index menolak yang kedua, ambil yang sudah ada.
    const again = await admin.from('ideas').select('id').eq('recording_id', recordingId).maybeSingle();
    if (again.data) return json({ idea_id: again.data.id });
    return fail('Gagal menyimpan draft', 500);
  }
  return json({ idea_id: inserted.data.id });
});
