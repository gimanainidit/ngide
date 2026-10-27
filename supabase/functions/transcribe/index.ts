import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { composeIdea, decidePendingPolish } from './compose.ts';
import { buildIdea } from './markdown.ts';
import { polish } from './polish.ts';
import { parseProviders, transcribeWithFallback } from './providers.ts';

const PROMPT =
  'Catatan ide pribadi dalam Bahasa Indonesia, kadang bercampur istilah English seperti app, feature, deadline, user.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DURATION_MS = 125_000; // 2 menit + toleransi
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 50_000;
const PENDING_BATCH = 10;

const env = (key: string) => Deno.env.get(key);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Payload = {
  recording_id: string;
  mode: 'cloud' | 'local';
  local_transcript: string | null;
  local_model: string | null;
  local: { edited: boolean; title: string; body_md: string } | null;
  polish: boolean;
};

function optionalText(value: unknown, max: number): string | null | false {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' && value.length <= max ? value : false;
}

function parsePayload(body: any): Payload | string {
  if (typeof body?.recording_id !== 'string' || !UUID.test(body.recording_id)) return 'recording_id tidak valid';
  const mode = body.mode ?? 'cloud';
  if (mode !== 'cloud' && mode !== 'local') return 'mode tidak valid';
  const transcript = optionalText(body.local_transcript, MAX_TEXT);
  const model = optionalText(body.local_model, 100);
  const title = optionalText(body.local_title, 200);
  const localBody = optionalText(body.local_body, MAX_TEXT);
  if (transcript === false || model === false || title === false || localBody === false) return 'Teks terlalu panjang';
  return {
    recording_id: body.recording_id,
    mode,
    local_transcript: transcript,
    local_model: model,
    local: body.local_edited === true && localBody ? { edited: true, title: title ?? '', body_md: localBody } : null,
    polish: body.polish !== false,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await req.json().catch(() => null);
  const url = env('SUPABASE_URL')!;
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body?.action === 'polish_pending') return polishPending(admin, body.secret);

  const userClient = createClient(url, env('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Belum login' }, 401);

  const payload = parsePayload(body);
  if (typeof payload === 'string') return json({ error: payload }, 400);
  const recordingId = payload.recording_id;

  // RLS: hanya pemilik rekaman yang bisa membacanya.
  const { data: rec } = await userClient.from('recordings').select('*').eq('id', recordingId).maybeSingle();
  if (!rec) return json({ error: 'Rekaman tidak ditemukan' }, 404);

  // Idempoten: kalau draft sudah ada (retry dari klien), kembalikan saja.
  const existing = await admin.from('ideas').select('id').eq('recording_id', recordingId).maybeSingle();
  if (existing.data) return json({ idea_id: existing.data.id });

  const fail = async (message: string, status: number) => {
    await admin.from('recordings').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', recordingId);
    return json({ error: message }, status);
  };

  if ((rec.duration_ms ?? 0) > MAX_DURATION_MS) return fail('Rekaman lebih dari 2 menit', 413);

  let transcript: string;
  let source: string;
  let model: string | null;

  if (payload.mode === 'cloud') {
    if (!rec.audio_path) return fail('Audio belum ter-upload', 409);
    const { data: file, error: downloadError } = await admin.storage.from('recordings').download(rec.audio_path);
    if (downloadError || !file) return fail('Audio belum ter-upload', 409);
    if (file.size > MAX_AUDIO_BYTES) return fail('Audio lebih dari 5 MB', 413);

    await admin.from('recordings').update({ status: 'transcribing', error: null }).eq('id', recordingId);
    const fileName = rec.audio_path.endsWith('.m4a') ? 'rekaman.m4a' : 'rekaman.wav';
    const outcome = await transcribeWithFallback(parseProviders(env), file, { language: 'id', prompt: PROMPT, fileName });

    if (outcome.ok) {
      ({ text: transcript, source, model } = outcome);
    } else if (payload.local_transcript?.trim()) {
      // Semua penyedia cloud gagal: jangan hilangkan ide, pakai transkrip dari HP.
      transcript = payload.local_transcript;
      source = 'local-whisper';
      model = payload.local_model;
    } else {
      return fail(outcome.message, outcome.permanent ? 422 : 502);
    }
  } else {
    if (!payload.local_transcript?.trim()) return fail('Transkrip lokal kosong', 422);
    transcript = payload.local_transcript;
    source = 'local-whisper';
    model = payload.local_model;
  }

  const at = new Date(rec.created_at);
  if (!buildIdea(transcript, at)) return fail('Tidak ada suara terdeteksi', 422);

  const polished = payload.polish ? await polish(transcript, env('GROQ_API_KEY'), env('GROQ_CHAT_MODEL')) : null;
  const { polish_status, ...idea } = composeIdea({
    transcript,
    at,
    polished,
    polishEnabled: payload.polish,
    local: payload.local,
  });

  await admin
    .from('recordings')
    .update({ status: 'done', raw_transcript: transcript, error: null, transcript_source: source, stt_model: model, polish_status })
    .eq('id', recordingId);

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
  return json({ idea_id: inserted.data.id, transcript_source: source, polish_status });
});

// Dipanggil pg_cron: rapikan ulang ide yang perapiannya tertunda.
async function polishPending(admin: SupabaseClient, secret: unknown) {
  if (typeof secret !== 'string' || !secret) return json({ error: 'Tidak diizinkan' }, 401);
  const { data: valid } = await admin.rpc('verify_cron_secret', { p_secret: secret });
  if (valid !== true) return json({ error: 'Tidak diizinkan' }, 401);

  const { data: recs } = await admin
    .from('recordings')
    .select('id,raw_transcript,polish_attempts')
    .eq('polish_status', 'pending')
    .not('raw_transcript', 'is', null)
    .order('created_at')
    .limit(PENDING_BATCH);

  let processed = 0;
  for (const rec of recs ?? []) {
    const { data: idea } = await admin.from('ideas').select('id,status,updated_by').eq('recording_id', rec.id).maybeSingle();
    if (!idea) {
      await admin.from('recordings').update({ polish_status: 'skipped' }).eq('id', rec.id);
      continue;
    }
    const polished = await polish(rec.raw_transcript, env('GROQ_API_KEY'), env('GROQ_CHAT_MODEL'));
    const decision = decidePendingPolish(idea, polished, rec.polish_attempts);
    if (decision.kind === 'overwrite' && polished) {
      await admin.from('ideas').update({ title: polished.title, body_md: polished.body_md }).eq('id', idea.id);
    } else if (decision.kind === 'suggest' && polished) {
      await admin.from('ideas').update({ suggested_title: polished.title, suggested_body_md: polished.body_md }).eq('id', idea.id);
    }
    await admin
      .from('recordings')
      .update({ polish_status: decision.polish_status, polish_attempts: rec.polish_attempts + 1 })
      .eq('id', rec.id);
    processed++;
  }
  return json({ processed });
}
