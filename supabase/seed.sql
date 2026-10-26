-- Tambahkan Gmail 2 anggota lain di array ini sebelum dipakai.
with t as (insert into public.teams (name) values ('Tim Ngide') returning id)
insert into public.team_allowlist (team_id, email)
select t.id, e from t, unnest(array[
  'labibeduph@gmail.com'
]) as e;
