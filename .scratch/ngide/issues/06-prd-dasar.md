# PRD dasar + standarisasi AI

## What to build
Tab PRD: daftar, buat (judul), editor markdown bebas. Tombol 'Susun jadi PRD standar (AI)' → Edge Function prd (aksi standardize) → pratinjau → Pakai/Batal. Bagian: Latar masalah, Nama solusi, Fitur utama, Fitur tambahan, Out of scope.

## Blocked by
01

## Status
done (kode) — uji SQL todo HP belum

## Acceptance criteria
- [ ] SQL: CRUD hanya anggota tim; hapus hanya pembuat
- [ ] Unit: prompt memuat isi PRD + kutipan; parser menolak hasil tanpa 5 bagian
- [ ] Unit Edge Function prd: 401/404, LLM gagal → 502, sukses → markdown
- [ ] HP: hasil AI tampil sebagai pratinjau, tidak menimpa sebelum Pakai

## Verifikasi RLS
2026-10-27: `supabase/tests/03_revisions_prd.check.sql` dijalankan di project produksi lewat SQL Editor, 21 lolos, 0 gagal.
