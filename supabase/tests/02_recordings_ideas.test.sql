-- Regresi RLS tiket 02+03. Jalankan: supabase test db
begin;
select plan(13);

insert into public.teams (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Tim Uji');
insert into public.team_allowlist values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000a1', 'b@example.com');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into public.recordings (id, owner_id, team_id, audio_path, status) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a/c1.m4a', 'done');
insert into public.ideas (id, team_id, author_id, recording_id, title, body_md) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Ide', 'Isi asli.');
insert into storage.objects (bucket_id, name, owner) values
  ('recordings', '00000000-0000-0000-0000-00000000000a/c1.m4a', '00000000-0000-0000-0000-00000000000a');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
select is((select count(*)::int from public.ideas), 0, 'draft tidak terlihat anggota lain');
select is((select count(*)::int from public.recordings), 0, 'rekaman tidak terlihat anggota lain');
select is((select count(*)::int from storage.objects where bucket_id = 'recordings'), 0, 'audio tidak terlihat anggota lain');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
update public.ideas set status = 'shared';
select is((select original_md from public.ideas), 'Isi asli.', 'share mengunci original_md');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
select is((select count(*)::int from public.ideas), 1, 'ide shared terlihat anggota tim');
select is((select count(*)::int from public.recordings), 0, 'rekaman tetap privat setelah share');
select is((select count(*)::int from storage.objects where bucket_id = 'recordings'), 0, 'audio tetap privat setelah share');
update public.ideas set body_md = 'Diedit B';
select is((select original_md from public.ideas), 'Isi asli.', 'edit tim tidak mengubah original_md');
select throws_ok($$update public.ideas set original_md = 'hack'$$, null, 'Versi asli tidak boleh diubah', 'original_md immutable');
select throws_ok($$update public.ideas set status = 'archived'$$, null, 'Hanya pembuat yang bisa mengubah status ide', 'non-pembuat tidak bisa ubah status');
select throws_ok($$update public.ideas set author_id = '00000000-0000-0000-0000-00000000000b'$$, null, 'Kolom ide ini tidak boleh diubah', 'author_id immutable');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff"}', true);
select is((select count(*)::int from public.ideas), 0, 'orang luar tidak melihat ide');

reset role;
set local role anon;
select is((select count(*)::int from public.ideas), 0, 'anon tidak melihat ide');

select * from finish();
rollback;
