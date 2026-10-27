-- Regresi RLS tiket 04 (riwayat) + 06/07 (PRD, kutipan).
-- Tanpa pgTAP: blok ini selalu diakhiri RAISE EXCEPTION berisi laporan,
-- sehingga semua data uji otomatis di-rollback. Jalankan lewat SQL editor.
do $$
declare
  t1 constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t2 constant uuid := '00000000-0000-0000-0000-0000000000a2';
  ua constant uuid := '00000000-0000-0000-0000-00000000000a';
  ub constant uuid := '00000000-0000-0000-0000-00000000000b';
  uc constant uuid := '00000000-0000-0000-0000-00000000000c';
  d1 constant uuid := '00000000-0000-0000-0000-0000000000d1';
  d2 constant uuid := '00000000-0000-0000-0000-0000000000d2';
  d3 constant uuid := '00000000-0000-0000-0000-0000000000d3';
  p1 constant uuid := '00000000-0000-0000-0000-0000000000e1';
  report text := '';
  pass int := 0;
  fail int := 0;
  n int;
  v text;
begin
  -- Data uji (sebagai postgres).
  insert into public.teams (id, name) values (t1, 'Tim Uji'), (t2, 'Tim Lain');
  insert into public.team_allowlist values (t1, 'a@example.com'), (t1, 'b@example.com'), (t2, 'c@example.com');
  insert into auth.users (id, email) values (ua, 'a@example.com'), (ub, 'b@example.com'), (uc, 'c@example.com');
  insert into public.ideas (id, team_id, author_id, title, body_md) values
    (d1, t1, ua, 'Ide A', 'Isi asli A.'),
    (d3, t1, ua, 'Draft A', 'Masih draft.'),
    (d2, t2, uc, 'Ide C', 'Isi C.');
  -- Share harus oleh pembuat (trigger ideas_guard), jadi pakai identitas C.
  perform set_config('request.jwt.claims', json_build_object('sub', uc)::text, true);
  update public.ideas set status = 'shared' where id = d2;

  execute 'set local role authenticated';

  -- ===== Tiket 04: riwayat =====
  perform set_config('request.jwt.claims', json_build_object('sub', ua)::text, true);
  update public.ideas set status = 'shared' where id = d1;
  select count(*) into n from public.idea_revisions where idea_id = d1;
  if n = 0 then pass := pass + 1; report := report || E'\nok   share tidak membuat revisi';
  else fail := fail + 1; report := report || E'\nFAIL share tidak membuat revisi (' || n || ')'; end if;

  select original_title into v from public.ideas where id = d1;
  if v = 'Ide A' then pass := pass + 1; report := report || E'\nok   share mengunci original_title';
  else fail := fail + 1; report := report || E'\nFAIL share mengunci original_title (' || coalesce(v, 'null') || ')'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', ub)::text, true);
  update public.ideas set body_md = 'Diedit B' where id = d1;
  select count(*) into n from public.idea_revisions where idea_id = d1 and editor_id = ub and body_md = 'Diedit B';
  if n = 1 then pass := pass + 1; report := report || E'\nok   edit tim tercatat di riwayat (editor B)';
  else fail := fail + 1; report := report || E'\nFAIL edit tim tercatat di riwayat (' || n || ')'; end if;

  select updated_by::text into v from public.ideas where id = d1;
  if v = ub::text then pass := pass + 1; report := report || E'\nok   updated_by = B';
  else fail := fail + 1; report := report || E'\nFAIL updated_by = B (' || coalesce(v, 'null') || ')'; end if;

  begin
    insert into public.idea_revisions (idea_id, editor_id, title, body_md) values (d1, ub, 'palsu', 'palsu');
    fail := fail + 1; report := report || E'\nFAIL insert revisi manual ditolak';
  exception when others then pass := pass + 1; report := report || E'\nok   insert revisi manual ditolak';
  end;

  update public.idea_revisions set body_md = 'hack' where idea_id = d1;
  get diagnostics n = row_count;
  if n = 0 then pass := pass + 1; report := report || E'\nok   revisi tidak bisa diubah';
  else fail := fail + 1; report := report || E'\nFAIL revisi tidak bisa diubah (' || n || ')'; end if;

  delete from public.idea_revisions where idea_id = d1;
  get diagnostics n = row_count;
  if n = 0 then pass := pass + 1; report := report || E'\nok   revisi tidak bisa dihapus';
  else fail := fail + 1; report := report || E'\nFAIL revisi tidak bisa dihapus (' || n || ')'; end if;

  begin
    update public.ideas set original_title = 'hack' where id = d1;
    fail := fail + 1; report := report || E'\nFAIL original_title immutable';
  exception when others then pass := pass + 1; report := report || E'\nok   original_title immutable';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', uc)::text, true);
  select count(*) into n from public.idea_revisions where idea_id = d1;
  if n = 0 then pass := pass + 1; report := report || E'\nok   tim lain tidak melihat riwayat';
  else fail := fail + 1; report := report || E'\nFAIL tim lain tidak melihat riwayat (' || n || ')'; end if;

  -- ===== Tiket 06: PRD =====
  perform set_config('request.jwt.claims', json_build_object('sub', ub)::text, true);
  begin
    insert into public.prds (id, team_id, title) values (p1, t1, 'PRD B');
    pass := pass + 1; report := report || E'\nok   anggota bisa buat PRD';
  exception when others then fail := fail + 1; report := report || E'\nFAIL anggota bisa buat PRD: ' || sqlerrm;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', uc)::text, true);
  select count(*) into n from public.prds where team_id = t1;
  if n = 0 then pass := pass + 1; report := report || E'\nok   tim lain tidak melihat PRD';
  else fail := fail + 1; report := report || E'\nFAIL tim lain tidak melihat PRD (' || n || ')'; end if;

  begin
    insert into public.prds (team_id, title) values (t1, 'Nyusup');
    fail := fail + 1; report := report || E'\nFAIL orang luar tidak bisa buat PRD di tim';
  exception when others then pass := pass + 1; report := report || E'\nok   orang luar tidak bisa buat PRD di tim';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', ua)::text, true);
  update public.prds set body_md = 'Diedit A' where id = p1;
  select updated_by::text into v from public.prds where id = p1;
  if v = ua::text then pass := pass + 1; report := report || E'\nok   anggota lain bisa edit PRD (updated_by = A)';
  else fail := fail + 1; report := report || E'\nFAIL anggota lain bisa edit PRD (' || coalesce(v, 'null') || ')'; end if;

  begin
    update public.prds set team_id = t2 where id = p1;
    fail := fail + 1; report := report || E'\nFAIL team_id PRD immutable';
  exception when others then pass := pass + 1; report := report || E'\nok   team_id PRD immutable';
  end;

  delete from public.prds where id = p1;
  get diagnostics n = row_count;
  if n = 0 then pass := pass + 1; report := report || E'\nok   hanya pembuat yang bisa hapus PRD';
  else fail := fail + 1; report := report || E'\nFAIL hanya pembuat yang bisa hapus PRD (' || n || ')'; end if;

  -- ===== Tiket 07: kutipan =====
  begin
    insert into public.prd_excerpts (prd_id, idea_id, quote_md, idea_updated_at)
      values (p1, d1, 'Diedit B', now());
    pass := pass + 1; report := report || E'\nok   kutip ide shared ke PRD';
  exception when others then fail := fail + 1; report := report || E'\nFAIL kutip ide shared ke PRD: ' || sqlerrm;
  end;

  begin
    insert into public.prd_excerpts (prd_id, idea_id, quote_md, idea_updated_at)
      values (p1, d3, 'Masih draft.', now());
    fail := fail + 1; report := report || E'\nFAIL ide draft tidak bisa dikutip';
  exception when others then pass := pass + 1; report := report || E'\nok   ide draft tidak bisa dikutip';
  end;

  begin
    insert into public.prd_excerpts (prd_id, idea_id, quote_md, idea_updated_at)
      values (p1, d2, 'Isi C.', now());
    fail := fail + 1; report := report || E'\nFAIL ide tim lain tidak bisa dikutip';
  exception when others then pass := pass + 1; report := report || E'\nok   ide tim lain tidak bisa dikutip';
  end;

  begin
    insert into public.prd_excerpts (prd_id, idea_id, quote_md, idea_updated_at, added_by)
      values (p1, d1, 'Atas nama B', now(), ub);
    fail := fail + 1; report := report || E'\nFAIL added_by tidak bisa dipalsukan';
  exception when others then pass := pass + 1; report := report || E'\nok   added_by tidak bisa dipalsukan';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', uc)::text, true);
  select count(*) into n from public.prd_excerpts where prd_id = p1;
  if n = 0 then pass := pass + 1; report := report || E'\nok   tim lain tidak melihat kutipan';
  else fail := fail + 1; report := report || E'\nFAIL tim lain tidak melihat kutipan (' || n || ')'; end if;

  execute 'reset role';
  execute 'set local role anon';
  begin
    select count(*) into n from public.prds;
  exception when insufficient_privilege then n := 0;
  end;
  if n = 0 then pass := pass + 1; report := report || E'\nok   anon tidak melihat PRD';
  else fail := fail + 1; report := report || E'\nFAIL anon tidak melihat PRD (' || n || ')'; end if;
  execute 'reset role';

  raise exception 'HASIL: % lolos, % gagal (semua data uji di-rollback)%', pass, fail, report;
end;
$$;
