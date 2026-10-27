import { timeAgo } from './format';

type Person = { display_name: string | null; email: string } | null | undefined;

export const personName = (p: Person) => p?.display_name ?? p?.email ?? 'Anggota';

// Pecah markdown jadi unit yang bisa dikutip: paragraf (dipisah baris kosong) atau butir daftar.
export function splitParagraphs(md: string): string[] {
  const out: string[] = [];
  for (const block of md.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
    if (lines.length === 0) continue;
    if (lines.every((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l))) out.push(...lines.map((l) => l.trim()));
    else out.push(lines.join('\n').trim());
  }
  return out;
}

export function editedLabel(
  idea: { author: Person; editor: Person; author_id: string; updated_by: string | null; updated_at: string },
  now = Date.now(),
): string {
  const base = `Ide asli: ${personName(idea.author)}`;
  if (!idea.updated_by || idea.updated_by === idea.author_id) return base;
  return `${base} · diedit ${personName(idea.editor)} ${timeAgo(idea.updated_at, now)}`;
}

export function attributionLine(idea: { author: Person; editor: Person }): string {
  return `Ide oleh ${personName(idea.author)} · versi terakhir ${personName(idea.editor ?? idea.author)}`;
}

// Kutipan adalah snapshot; tandai bila ide sumbernya diubah setelah dikutip.
export function excerptChanged(quotedAt: string, ideaUpdatedAt: string | null): boolean {
  if (!ideaUpdatedAt) return false;
  return Date.parse(ideaUpdatedAt) > Date.parse(quotedAt);
}
