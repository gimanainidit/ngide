-- Tiket 14: job terjadwal merapikan ulang ide yang perapiannya tertunda.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secret acak di Vault; tidak pernah keluar dari database kecuali ke Edge Function.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ngide_cron_secret', 'Secret untuk aksi polish_pending');

create function public.verify_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets where name = 'ngide_cron_secret' and decrypted_secret = p_secret
  );
$$;

revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- Bearer = anon key legacy (publik) agar lolos verify_jwt; otorisasi sebenarnya lewat secret.
select cron.schedule(
  'ngide-polish-pending',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://qsgbmkcpjpgimmmqzxup.supabase.co/functions/v1/transcribe',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZ2Jta2NwanBnaW1tbXF6eHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjM2MTcsImV4cCI6MjEwODU5OTYxN30.qbYv-WcUZfQejp_u2pJUyLTn_pV7gs0ikxf7zCMVmD0'
    ),
    body := jsonb_build_object(
      'action', 'polish_pending',
      'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ngide_cron_secret')
    )
  );
  $job$
);
