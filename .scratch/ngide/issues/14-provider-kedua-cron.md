# Provider STT kedua + job perapian ulang

## What to build
Tambah provider STT cadangan di server dan job pg_cron yang merapikan ulang ide dengan polish_status pending.

## Blocked by
10

## Status
done (kode) — uji di HP belum

## Acceptance criteria
- [ ] Tes mock: provider 1 gagal → provider 2 dipakai
- [ ] Job memproses pending dan idempoten
