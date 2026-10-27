// Prompt & parser standarisasi PRD. Pure, tanpa API Deno.
export const PRD_SECTIONS = ['Latar masalah', 'Nama solusi', 'Fitur utama', 'Fitur tambahan', 'Out of scope'] as const;

const SYSTEM = `Kamu menyusun Product Requirements Document (PRD) singkat dari catatan ide tim.
Aturan:
- Pakai bahasa yang sama dengan catatan (Indonesia, boleh campur istilah English). Jangan menerjemahkan.
- Jangan mengarang fakta, angka, atau fitur yang tidak ada di catatan. Kalau sebuah bagian tidak punya bahan, tulis "_Belum dibahas._".
- Susun tepat lima bagian dengan heading level 2, berurutan: ${PRD_SECTIONS.map((s) => `"## ${s}"`).join(', ')}.
- "Nama solusi": satu nama singkat + satu kalimat penjelasan.
- Fitur ditulis sebagai poin "- ".
Balas HANYA JSON: {"markdown": string}.`;

export function buildStandardizeMessages(input: {
  title: string;
  body_md: string;
  excerpts: { quote_md: string; author: string }[];
}) {
  const ideas = input.excerpts.map((e, i) => `${i + 1}. (${e.author}) ${e.quote_md.trim()}`).join('\n');
  const user = `Judul PRD: ${input.title}\n\nIsi PRD saat ini:\n${input.body_md.trim() || '(kosong)'}\n\nKutipan ide terkait:\n${ideas || '(tidak ada)'}`;
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}

// Null bila tidak berbentuk JSON {markdown} atau ada bagian yang hilang/tidak berurutan.
export function parseStandardized(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  let markdown: unknown;
  try {
    markdown = JSON.parse(content)?.markdown;
  } catch {
    return null;
  }
  if (typeof markdown !== 'string' || !markdown.trim()) return null;
  let cursor = -1;
  for (const section of PRD_SECTIONS) {
    const at = markdown.search(new RegExp(`^##\\s+${section}\\s*$`, 'mi'));
    if (at <= cursor) return null;
    cursor = at;
  }
  return markdown.trim();
}
