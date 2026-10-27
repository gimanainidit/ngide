// Aturan menyusun ide dari transkrip. Pure, tanpa API Deno.
import { buildIdea } from './markdown.ts';

export type PolishStatus = 'none' | 'pending' | 'done' | 'suggested' | 'skipped';
type Text = { title: string; body_md: string };

const MAX_POLISH_ATTEMPTS = 5;

export function composeIdea(input: {
  transcript: string;
  at: Date;
  polished: Text | null;
  polishEnabled: boolean;
  local: { edited: boolean; title: string; body_md: string } | null;
}): Text & { suggested_title: string | null; suggested_body_md: string | null; polish_status: PolishStatus } {
  const raw = buildIdea(input.transcript, input.at) ?? { title: '', body_md: '' };
  const missing: PolishStatus = input.polishEnabled ? 'pending' : 'skipped';

  // Editan user tidak pernah ditimpa: hasil rapi hanya jadi saran.
  if (input.local?.edited && input.local.body_md.trim()) {
    return {
      title: input.local.title.trim() || raw.title,
      body_md: input.local.body_md,
      suggested_title: input.polished?.title ?? null,
      suggested_body_md: input.polished?.body_md ?? null,
      polish_status: input.polished ? 'suggested' : missing,
    };
  }

  const base = input.polished ?? raw;
  return {
    ...base,
    suggested_title: null,
    suggested_body_md: null,
    polish_status: input.polished ? 'done' : missing,
  };
}

export function decidePendingPolish(
  idea: { status: string; updated_by: string | null },
  polished: Text | null,
  attempts: number,
):
  | { kind: 'overwrite'; polish_status: 'done' }
  | { kind: 'suggest'; polish_status: 'suggested' }
  | { kind: 'retry'; polish_status: 'pending' }
  | { kind: 'give_up'; polish_status: 'skipped' } {
  if (idea.status === 'archived') return { kind: 'give_up', polish_status: 'skipped' };
  if (!polished) {
    return attempts + 1 >= MAX_POLISH_ATTEMPTS
      ? { kind: 'give_up', polish_status: 'skipped' }
      : { kind: 'retry', polish_status: 'pending' };
  }
  // Hanya draft yang belum pernah disentuh manusia yang boleh ditimpa.
  if (idea.status === 'draft' && idea.updated_by === null) return { kind: 'overwrite', polish_status: 'done' };
  return { kind: 'suggest', polish_status: 'suggested' };
}
