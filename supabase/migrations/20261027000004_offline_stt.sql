-- Tiket 09: batas rekam 2 menit (toleransi 5 detik) + bucket 5 MB, WAV diizinkan.
alter table public.recordings
  add constraint recordings_duration_max check (duration_ms between 0 and 125000);

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['audio/wav','audio/x-wav','audio/wave','audio/mp4','audio/m4a','audio/x-m4a','audio/aac']
where id = 'recordings';

-- Tiket 10: asal transkrip & status perapian.
alter table public.recordings
  add column transcript_source text check (transcript_source in ('groq','openai','local-whisper')),
  add column stt_model text,
  add column polish_status text not null default 'none'
    check (polish_status in ('none','pending','done','suggested','skipped')),
  add column polish_attempts integer not null default 0;

-- Tiket 13: mode "Selalu lokal" tidak pernah mengunggah audio.
alter table public.recordings alter column audio_path drop not null;

create index recordings_polish_pending_idx on public.recordings (created_at) where polish_status = 'pending';

-- Tiket 13: saran versi rapi, hanya ditulis server.
alter table public.ideas
  add column suggested_title text,
  add column suggested_body_md text;

create or replace function public.ideas_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if new.author_id is distinct from old.author_id
     or new.team_id is distinct from old.team_id
     or new.recording_id is distinct from old.recording_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Kolom ide ini tidak boleh diubah';
  end if;

  if new.original_md is distinct from old.original_md and old.original_md is not null then
    raise exception 'Versi asli tidak boleh diubah';
  end if;

  -- Klien hanya boleh menghapus saran (terima/abaikan), bukan menulisnya.
  if uid is not null and (
       (new.suggested_title is distinct from old.suggested_title and new.suggested_title is not null)
    or (new.suggested_body_md is distinct from old.suggested_body_md and new.suggested_body_md is not null)) then
    raise exception 'Saran hanya bisa dibuat oleh server';
  end if;

  if new.status is distinct from old.status then
    if uid is distinct from old.author_id then
      raise exception 'Hanya pembuat yang bisa mengubah status ide';
    end if;
    if old.status = 'draft' and new.status = 'shared' then
      new.original_md := new.body_md;
      new.shared_at := now();
    elsif old.status = 'shared' and new.status = 'archived' then
      null;
    else
      raise exception 'Perubahan status % -> % tidak diizinkan', old.status, new.status;
    end if;
  end if;

  new.original_md := coalesce(old.original_md, new.original_md);
  new.shared_at := coalesce(old.shared_at, new.shared_at);
  if uid is null then
    -- Server (service role): jangan menghapus jejak siapa yang terakhir mengedit.
    new.updated_by := old.updated_by;
    new.updated_at := old.updated_at;
  else
    new.updated_by := uid;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.ideas_guard() from public, anon, authenticated;
