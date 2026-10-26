-- Ganti 3 email ini dengan Gmail anggota tim sebelum dipakai.
with t as (insert into public.teams (name) values ('Tim Ngide') returning id)
insert into public.team_allowlist (team_id, email)
select t.id, e from t, unnest(array[
  'labibeduph@gmail.com',
  'anggota2@gmail.com',
  'anggota3@gmail.com'
]) as e;
