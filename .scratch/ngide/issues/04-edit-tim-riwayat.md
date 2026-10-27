# Edit tim + riwayat (hanya baca)

## What to build
Anggota tim mengedit ide shared. Trigger mencatat revisi (append-only) dengan editor; original_title disimpan saat share. Label 'Ide asli: X · diedit Y waktu'. Layar Riwayat: versi asli + daftar revisi (siapa, kapan, isi), hanya baca. Simpan memakai syarat updated_at; bentrok → pesan + muat ulang.

## Blocked by
03

## Status
done (kode) — uji SQL todo HP belum

## Acceptance criteria
- [ ] SQL: edit B pada ide shared A membuat 1 revisi dengan editor B
- [ ] SQL: klien tidak bisa insert/update/delete revisi; draft tidak membuat revisi
- [ ] Unit: label atribusi; bentrok terdeteksi (update 0 baris)
- [ ] HP: B edit ide A, A melihat label & riwayat

## Verifikasi RLS
2026-10-27: `supabase/tests/03_revisions_prd.check.sql` dijalankan di project produksi lewat SQL Editor, 21 lolos, 0 gagal.
