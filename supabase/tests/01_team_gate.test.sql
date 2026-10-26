begin;
select plan(5);

insert into public.teams (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Tim Uji');
insert into public.team_allowlist values ('00000000-0000-0000-0000-0000000000a1', 'anggota@example.com');

select throws_ok(
  $$insert into auth.users (id, email) values (gen_random_uuid(), 'orang.luar@example.com')$$,
  'P0001', null, 'email di luar allowlist ditolak'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000b1', 'Anggota@Example.com', '{"full_name":"Anggota Satu"}');

select is((select count(*)::int from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b1'), 1,
  'email allowlist (case-insensitive) otomatis jadi anggota');

select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'Anggota Satu',
  'profil dibuat dari metadata Google');

-- anggota melihat timnya
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
select is((select count(*)::int from public.teams), 1, 'anggota melihat timnya');

-- user lain (bukan anggota) tidak melihat apa pun
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff"}', true);
select is((select count(*)::int from public.teams), 0, 'non-anggota tidak melihat tim');

select * from finish();
rollback;
