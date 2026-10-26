// Pure TS, tanpa API Deno, supaya bisa dites dengan vitest.
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const KALIMAT_PER_PARAGRAF = 3;

export function formatTitle(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `Ide ${Number(get('day'))} ${BULAN[Number(get('month')) - 1]} ${get('hour')}.${get('minute')}`;
}

export function paragraphize(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += KALIMAT_PER_PARAGRAF) {
    paragraphs.push(sentences.slice(i, i + KALIMAT_PER_PARAGRAF).join(' '));
  }
  return paragraphs.join('\n\n');
}

export function buildIdea(transcript: string, at: Date): { title: string; body_md: string } | null {
  const body_md = paragraphize(transcript);
  if (!body_md) return null;
  return { title: formatTitle(at), body_md };
}

export const POLISH_SYSTEM_PROMPT = `Kamu merapikan transkrip suara menjadi catatan ide singkat dalam markdown.
Aturan:
- Pertahankan bahasa asli pembicara (Indonesia dan English boleh bercampur). Jangan menerjemahkan.
- Perbaiki kata yang jelas salah dengar dan hapus pengulangan atau "eee/hmm", tetapi jangan menambah ide atau fakta baru.
- Susun menjadi paragraf pendek atau poin "- " agar mudah dibaca. Boleh memakai **tebal** untuk istilah kunci.
- Buat judul singkat (maksimal 8 kata) yang menggambarkan ide.
Balas HANYA JSON: {"title": string, "body_md": string}.`;

export function buildPolishMessages(transcript: string) {
  return [
    { role: 'system', content: POLISH_SYSTEM_PROMPT },
    { role: 'user', content: transcript.trim() },
  ];
}

// Parse balasan LLM; null kalau bentuknya tidak sesuai agar pemanggil fallback ke transkrip mentah.
export function parsePolished(content: unknown): { title: string; body_md: string } | null {
  if (typeof content !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  const { title, body_md } = (data ?? {}) as { title?: unknown; body_md?: unknown };
  if (typeof title !== 'string' || typeof body_md !== 'string') return null;
  const t = title.trim();
  const b = body_md.trim();
  if (!t || !b || t.length > 120) return null;
  return { title: t, body_md: b };
}
