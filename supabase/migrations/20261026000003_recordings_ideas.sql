-- Ticket 02+03: rekaman privat, ide (draft -> shared), bucket audio privat

create table public.recordings (
  id uuid primary key,                       -- dibuat di klien agar upload/transkrip idempotent
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  audio_path text not null,
  duration_ms integer,
  raw_transcript text,
  status text not null default 'uploaded'
    check (status in ('uploaded','transcribing','done','failed')),
  error text,
  created_at timestamptz not null default now(),
  constraint audio_path_owner check (audio_path like owner_id::text || '/%')
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  recording_id uuid references public.recordings(id) on delete set null,
  title text not null,
  body_md text not null,
  original_md text,                          -- snapshot saat di-share, immutable
  status text not null default 'draft' check (status in ('draft','shared','archived')),
  shared_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index ideas_recording_id_key on public.ideas (recording_id) where recording_id is not null;
create index ideas_team_shared_idx on public.ideas (team_id, shared_at desc) where status = 'shared';
create index ideas_author_idx on public.ideas (author_id, created_at desc);

alter table public.recordings enable row level security;
alter table public.ideas enable row level security;

-- Rekaman: HANYA pemilik. Tidak ada akses tim sama sekali.
create policy recordings_select on public.recordings for select to authenticated
  using (owner_id = (select auth.uid()));
create policy recordings_insert on public.recordings for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_team_member(team_id)
    and status = 'uploaded'
  );
create policy recordings_delete on public.recordings for delete to authenticated
  using (owner_id = (select auth.uid()));
-- update/transkrip dilakukan Edge Function (service role), bukan klien.

-- Ide: draft hanya penulis; shared terlihat seluruh tim.
create policy ideas_select on public.ideas for select to authenticated
  using (
    author_id = (select auth.uid())
    or (status = 'shared' and public.is_team_member(team_id))
  );
create policy ideas_update on public.ideas for update to authenticated
  using (
    author_id = (select auth.uid())
    or (status = 'shared' and public.is_team_member(team_id))
  )
  with check (
    author_id = (select auth.uid())
    or (status = 'shared' and public.is_team_member(team_id))
  );
create policy ideas_delete on public.ideas for delete to authenticated
  using (author_id = (select auth.uid()) and status = 'draft');
-- insert hanya lewat Edge Function (service role).

-- Guard perubahan ide: kolom kunci immutable, share satu arah, versi asli terkunci.
create function public.ideas_guard()
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
  new.updated_by := uid;
  new.updated_at := now();
  return new;
end;
$$;

create trigger ideas_guard before update on public.ideas
  for each row execute function public.ideas_guard();

revoke execute on function public.ideas_guard() from public, anon, authenticated;

-- Bucket audio privat: folder pertama = id pemilik.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 26214400,
        array['audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/mpeg'])
on conflict (id) do nothing;

create policy recordings_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
