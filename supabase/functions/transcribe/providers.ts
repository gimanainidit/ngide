// Rantai penyedia speech-to-text. Pure: fetch disuntikkan supaya bisa dites.
export type TranscriptSource = 'groq' | 'openai';

export type SttProvider = {
  id: string;
  source: TranscriptSource;
  model: string;
  url: string;
  key: string;
};

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_ORDER = 'groq-turbo,groq-large';
const TIMEOUT_MS = 30_000;

const DEFINITIONS: Record<string, { source: TranscriptSource; model: string; url: string; keyEnv: string }> = {
  'groq-turbo': { source: 'groq', model: 'whisper-large-v3-turbo', url: GROQ_STT_URL, keyEnv: 'GROQ_API_KEY' },
  'groq-large': { source: 'groq', model: 'whisper-large-v3', url: GROQ_STT_URL, keyEnv: 'GROQ_API_KEY' },
  openai: { source: 'openai', model: 'gpt-4o-mini-transcribe', url: OPENAI_STT_URL, keyEnv: 'OPENAI_API_KEY' },
};

export function parseProviders(env: (key: string) => string | undefined): SttProvider[] {
  const order = (env('STT_PROVIDERS') ?? DEFAULT_ORDER).split(',').map((s) => s.trim()).filter(Boolean);
  const providers: SttProvider[] = [];
  for (const id of order) {
    const def = DEFINITIONS[id];
    const key = def && env(def.keyEnv);
    if (def && key) providers.push({ id, source: def.source, model: def.model, url: def.url, key });
  }
  return providers;
}

// 'audio': audionya yang bermasalah, provider lain juga akan menolak → berhenti.
// 'provider': kunci/akses provider ini bermasalah → coba provider berikutnya.
// 'transient': kemungkinan pulih → coba provider berikutnya.
export function classifyStatus(status: number): 'audio' | 'provider' | 'transient' {
  if ([400, 413, 415, 422].includes(status)) return 'audio';
  if ([401, 403, 404].includes(status)) return 'provider';
  return 'transient';
}

export type SttOutcome =
  | { ok: true; text: string; source: TranscriptSource; model: string }
  | { ok: false; permanent: boolean; message: string };

export async function transcribeWithFallback(
  providers: SttProvider[],
  audio: Blob,
  opts: { language: string; prompt: string; fileName: string },
  fetchFn: typeof fetch = fetch,
): Promise<SttOutcome> {
  if (providers.length === 0) {
    return { ok: false, permanent: false, message: 'Tidak ada penyedia transkripsi yang dikonfigurasi' };
  }
  const failures: string[] = [];
  for (const p of providers) {
    const form = new FormData();
    form.append('file', new File([audio], opts.fileName, { type: audio.type || 'audio/wav' }));
    form.append('model', p.model);
    form.append('language', opts.language);
    form.append('prompt', opts.prompt);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    try {
      const res = await fetchFn(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, text: String(data?.text ?? ''), source: p.source, model: p.model };
      }
      if (classifyStatus(res.status) === 'audio') {
        return { ok: false, permanent: true, message: `Audio ditolak penyedia transkripsi (${res.status})` };
      }
      failures.push(`${p.id}:${res.status}`);
    } catch {
      failures.push(`${p.id}:network`);
    }
  }
  return { ok: false, permanent: false, message: `Transkripsi gagal (${failures.join(', ')})` };
}
