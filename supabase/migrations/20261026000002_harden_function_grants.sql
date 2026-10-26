-- Fungsi trigger tidak boleh bisa dipanggil klien via /rest/v1/rpc.
revoke execute on function public.gate_signup() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- is_team_member dipakai policy RLS, jadi hanya authenticated yang boleh.
revoke execute on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;
