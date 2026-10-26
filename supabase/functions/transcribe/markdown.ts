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
