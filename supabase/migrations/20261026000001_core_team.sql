-- Ticket 01: tim, allowlist, profil, gerbang masuk
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.team_allowlist (
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  primary key (team_id, email),
  constraint email_lowercase check (email = lower(email))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  primary key (team_id, user_id)
);

alter table public.teams enable row level security;
alter table public.team_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.team_members enable row level security;

create function public.is_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid())
  );
$$;

-- Tolak signup dari email yang tidak ada di allowlist.
create function public.gate_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.team_allowlist where email = lower(new.email)) then
    raise exception 'Email % tidak terdaftar di tim', new.email using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger gate_signup before insert on auth.users
  for each row execute function public.gate_signup();

-- Setelah user dibuat: buat profil dan masukkan ke tim.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id, lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.team_members (team_id, user_id)
  select team_id, new.id from public.team_allowlist where email = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: hanya anggota tim yang melihat tim dan profil sesama anggota.
create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));

create policy members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid()) or exists (
      select 1 from public.team_members a
      join public.team_members b on a.team_id = b.team_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );
-- team_allowlist: tanpa policy = tidak terbaca klien (hanya service role).
