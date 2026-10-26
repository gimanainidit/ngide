import { randomUUID } from 'expo-crypto';
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
  author?: { display_name: string | null; email: string } | null;
};

const IDEA_COLUMNS =
  'id,team_id,author_id,recording_id,title,body_md,original_md,status,shared_at,updated_by,updated_at,created_at,author:profiles!ideas_author_id_fkey(display_name,email)';

export function authorName(idea: Pick<Idea, 'author'>): string {
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

export async function saveIdea(id: string, fields: { title: string; body_md: string }) {
  const { error } = await supabase.from('ideas').update(fields).eq('id', id);
  if (error) throw error;
}

export async function shareIdea(id: string) {
  const { error } = await supabase.from('ideas').update({ status: 'shared' }).eq('id', id);
  if (error) throw error;
}

export async function deleteDraft(id: string) {
  const { error } = await supabase.from('ideas').delete().eq('id', id).eq('status', 'draft');
  if (error) throw error;
}

export async function getAudioUrl(recordingId: string): Promise<string> {
  const { data: rec, error } = await supabase
    .from('recordings')
    .select('audio_path')
    .eq('id', recordingId)
    .single();
  if (error) throw error;
  const { data, error: signError } = await supabase.storage
    .from('recordings')
    .createSignedUrl(rec.audio_path, 3600);
  if (signError) throw signError;
  return data.signedUrl;
}

export type PendingRecording = { id: string; uri: string; durationMs: number };

export function newPendingRecording(uri: string, durationMs: number): PendingRecording {
  return { id: randomUUID(), uri, durationMs };
}

// Idempoten: aman dipanggil ulang dengan PendingRecording yang sama.
export async function uploadAndTranscribe(p: PendingRecording): Promise<string> {
  const me = await getMe();
  if (!me.team) throw new Error('Akun ini belum tergabung di tim');

  const path = `${me.id}/${p.id}.m4a`;
  const audio = await (await fetch(p.uri)).arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(path, audio, { contentType: 'audio/mp4', upsert: true });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('recordings').insert({
    id: p.id,
    team_id: me.team.id,
    audio_path: path,
    duration_ms: p.durationMs,
  });
  if (insertError && insertError.code !== '23505') throw insertError;

  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { recording_id: p.id },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data.idea_id as string;
}
