-- Tiket 04: riwayat revisi ide (append-only) + judul asli.
alter table public.ideas add column original_title text;

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

  if (new.original_md is distinct from old.original_md and old.original_md is not null)
     or (new.original_title is distinct from old.original_title and old.original_title is not null) then
    raise exception 'Versi asli tidak boleh diubah';
  end if;

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
      new.original_title := new.title;
      new.shared_at := now();
    elsif old.status = 'shared' and new.status = 'archived' then
      null;
    else
      raise exception 'Perubahan status % -> % tidak diizinkan', old.status, new.status;
    end if;
  end if;

  new.original_md := coalesce(old.original_md, new.original_md);
  new.original_title := coalesce(old.original_title, new.original_title);
  new.shared_at := coalesce(old.shared_at, new.shared_at);
  if uid is null then
    new.updated_by := old.updated_by;
    new.updated_at := old.updated_at;
  else
    new.updated_by := uid;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Ide yang sudah dibagikan sebelum migrasi: judul saat ini dianggap judul asli.
update public.ideas set original_title = title where status <> 'draft' and original_title is null;

create table public.idea_revisions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  editor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body_md text not null,
  created_at timestamptz not null default now()
);
create index idea_revisions_idea_idx on public.idea_revisions (idea_id, created_at desc);
alter table public.idea_revisions enable row level security;

-- Dibaca anggota tim untuk ide yang sudah dibagikan. Tanpa policy tulis: append-only lewat trigger.
create policy idea_revisions_select on public.idea_revisions for select to authenticated
  using (exists (
    select 1 from public.ideas i
    where i.id = idea_id and i.status <> 'draft' and public.is_team_member(i.team_id)
  ));

create function public.ideas_log_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status <> 'draft' and (new.title is distinct from old.title or new.body_md is distinct from old.body_md) then
    insert into public.idea_revisions (idea_id, editor_id, title, body_md)
    values (new.id, new.updated_by, new.title, new.body_md);
  end if;
  return null;
end;
$$;

create trigger ideas_log_revision after update on public.ideas
  for each row execute function public.ideas_log_revision();

revoke execute on function public.ideas_guard() from public, anon, authenticated;
revoke execute on function public.ideas_log_revision() from public, anon, authenticated;

-- Tiket 06: PRD per tim.
create table public.prds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  body_md text not null default '' check (length(body_md) <= 100000),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prds_team_idx on public.prds (team_id, updated_at desc);
alter table public.prds enable row level security;

create policy prds_select on public.prds for select to authenticated using (public.is_team_member(team_id));
create policy prds_insert on public.prds for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = (select auth.uid()));
create policy prds_update on public.prds for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy prds_delete on public.prds for delete to authenticated
  using (public.is_team_member(team_id) and created_by = (select auth.uid()));

create function public.prds_touch()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.team_id is distinct from old.team_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Kolom PRD ini tidak boleh diubah';
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
create trigger prds_touch before update on public.prds for each row execute function public.prds_touch();
revoke execute on function public.prds_touch() from public, anon, authenticated;

-- Tiket 07: kutipan snapshot dari ide yang sudah dibagikan.
create table public.prd_excerpts (
  id uuid primary key default gen_random_uuid(),
  prd_id uuid not null references public.prds(id) on delete cascade,
  idea_id uuid not null references public.ideas(id) on delete cascade,
  quote_md text not null check (length(btrim(quote_md)) between 1 and 20000),
  idea_updated_at timestamptz not null,
  added_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index prd_excerpts_prd_idx on public.prd_excerpts (prd_id, position, created_at);
create index prd_excerpts_idea_idx on public.prd_excerpts (idea_id);
alter table public.prd_excerpts enable row level security;

create policy prd_excerpts_select on public.prd_excerpts for select to authenticated
  using (exists (select 1 from public.prds p where p.id = prd_id and public.is_team_member(p.team_id)));
create policy prd_excerpts_insert on public.prd_excerpts for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and exists (
      select 1 from public.prds p join public.ideas i on i.id = idea_id
      where p.id = prd_id and i.team_id = p.team_id and i.status = 'shared' and public.is_team_member(p.team_id)
    )
  );
create policy prd_excerpts_delete on public.prd_excerpts for delete to authenticated
  using (exists (select 1 from public.prds p where p.id = prd_id and public.is_team_member(p.team_id)));
