import { supabase } from './supabase';

export type IdeaStatus = 'draft' | 'shared' | 'archived';

export type Idea = {
  id: string;
  team_id: string;
  author_id: string;
  recording_id: string | null;
  title: string;
  body_md: string;
  original_md: string | null;
  status: IdeaStatus;
  shared_at: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  suggested_title: string | null;
  suggested_body_md: string | null;
  original_title: string | null;
  author?: Person;
  editor?: Person;
};

export type Person = { display_name: string | null; email: string } | null;

const IDEA_COLUMNS =
  'id,team_id,author_id,recording_id,title,body_md,original_md,status,shared_at,updated_by,updated_at,created_at,suggested_title,suggested_body_md,original_title,author:profiles!ideas_author_id_fkey(display_name,email),editor:profiles!ideas_updated_by_fkey(display_name,email)';

export function authorName(idea: { author?: Person }): string {
  return idea.author?.display_name ?? idea.author?.email ?? 'Anggota';
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Belum login');
  return data.user.id;
}

export async function getMe() {
  const id = await currentUserId();
  const [profile, team] = await Promise.all([
    supabase.from('profiles').select('display_name,email').eq('id', id).single(),
    supabase.from('teams').select('id,name').limit(1).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (team.error) throw team.error;
  return {
    id,
    name: profile.data.display_name ?? profile.data.email,
    team: team.data as { id: string; name: string } | null,
  };
}

export async function listMyIdeas(): Promise<Idea[]> {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from('ideas')
    .select(IDEA_COLUMNS)
    .eq('author_id', id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Idea[];
}

export async function listTeamIdeas(): Promise<Idea[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select(IDEA_COLUMNS)
    .eq('status', 'shared')
    .order('shared_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Idea[];
}

export async function getIdea(id: string): Promise<Idea> {
  const { data, error } = await supabase.from('ideas').select(IDEA_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return data as unknown as Idea;
}

export class EditConflictError extends Error {}

// Simpan hanya bila ide belum diubah orang lain sejak dimuat (optimistic concurrency).
export async function saveIdea(id: string, fields: { title: string; body_md: string }, loadedUpdatedAt: string) {
  const { data, error } = await supabase.from('ideas').update(fields).eq('id', id).eq('updated_at', loadedUpdatedAt).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const fresh = await getIdea(id);
    const who = fresh.editor?.display_name ?? fresh.editor?.email ?? 'anggota lain';
    throw new EditConflictError(`Ide ini baru diubah ${who}. Muat ulang dulu supaya editanmu tidak menimpa.`);
  }
}

export type Revision = { id: string; title: string; body_md: string; created_at: string; editor: Person };

export async function listRevisions(ideaId: string): Promise<Revision[]> {
  const { data, error } = await supabase
    .from('idea_revisions')
    .select('id,title,body_md,created_at,editor:profiles!idea_revisions_editor_id_fkey(display_name,email)')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Revision[];
}

// --- PRD ---

export type Prd = {
  id: string;
  team_id: string;
  title: string;
  body_md: string;
  created_by: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  editor?: Person;
};

export type Excerpt = {
  id: string;
  prd_id: string;
  idea_id: string;
  quote_md: string;
  idea_updated_at: string;
  created_at: string;
  idea: { id: string; title: string; updated_at: string; author: Person; editor: Person } | null;
};

const PRD_COLUMNS = 'id,team_id,title,body_md,created_by,updated_by,updated_at,created_at,editor:profiles!prds_updated_by_fkey(display_name,email)';

export async function listPrds(): Promise<Prd[]> {
  const { data, error } = await supabase.from('prds').select(PRD_COLUMNS).order('updated_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Prd[];
}

export async function getPrd(id: string): Promise<Prd> {
  const { data, error } = await supabase.from('prds').select(PRD_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return data as unknown as Prd;
}

export async function createPrd(title: string): Promise<string> {
  const me = await getMe();
  if (!me.team) throw new Error('Akun ini belum tergabung di tim');
  const { data, error } = await supabase.from('prds').insert({ team_id: me.team.id, title: title.trim() }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function savePrd(id: string, fields: { title: string; body_md: string }) {
  const { error } = await supabase.from('prds').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deletePrd(id: string) {
  const { data, error } = await supabase.from('prds').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Hanya pembuat PRD yang bisa menghapusnya');
}

export async function listExcerpts(prdId: string): Promise<Excerpt[]> {
  const { data, error } = await supabase
    .from('prd_excerpts')
    .select(
      'id,prd_id,idea_id,quote_md,idea_updated_at,created_at,idea:ideas(id,title,updated_at,author:profiles!ideas_author_id_fkey(display_name,email),editor:profiles!ideas_updated_by_fkey(display_name,email))',
    )
    .eq('prd_id', prdId)
    .order('position')
    .order('created_at');
  if (error) throw error;
  return data as unknown as Excerpt[];
}

export async function addExcerpts(prdId: string, idea: Pick<Idea, 'id' | 'updated_at'>, quotes: string[]) {
  const { error } = await supabase
    .from('prd_excerpts')
    .insert(quotes.map((quote_md) => ({ prd_id: prdId, idea_id: idea.id, quote_md, idea_updated_at: idea.updated_at })));
  if (error) throw error;
}

export async function deleteExcerpt(id: string) {
  const { error } = await supabase.from('prd_excerpts').delete().eq('id', id);
  if (error) throw error;
}

export async function standardizePrd(prdId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('prd', { body: { action: 'standardize', prd_id: prdId } });
  if (error) {
    const body = await (error as { context?: Response }).context?.json().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data.markdown as string;
}

export async function shareIdea(id: string) {
  const { error } = await supabase.from('ideas').update({ status: 'shared' }).eq('id', id);
  if (error) throw error;
}

export async function deleteDraft(id: string) {
  const { error } = await supabase.from('ideas').delete().eq('id', id).eq('status', 'draft');
  if (error) throw error;
}

// Null bila audio tidak pernah diunggah (mode Selalu lokal).
export async function getAudioUrl(recordingId: string): Promise<string | null> {
  const { data: rec, error } = await supabase
    .from('recordings')
    .select('audio_path')
    .eq('id', recordingId)
    .single();
  if (error) throw error;
  if (!rec.audio_path) return null;
  const { data, error: signError } = await supabase.storage
    .from('recordings')
    .createSignedUrl(rec.audio_path, 3600);
  if (signError) throw signError;
  return data.signedUrl;
}

export async function acceptSuggestion(idea: Idea) {
  if (!idea.suggested_body_md) return;
  const { error } = await supabase
    .from('ideas')
    .update({
      title: idea.suggested_title ?? idea.title,
      body_md: idea.suggested_body_md,
      suggested_title: null,
      suggested_body_md: null,
    })
    .eq('id', idea.id);
  if (error) throw error;
}

export async function dismissSuggestion(id: string) {
  const { error } = await supabase.from('ideas').update({ suggested_title: null, suggested_body_md: null }).eq('id', id);
  if (error) throw error;
}
