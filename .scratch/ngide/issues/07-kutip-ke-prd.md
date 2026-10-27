# Kutip paragraf ke PRD

## What to build
Di detail ide shared: 'Kutip ke PRD' → pilih paragraf → pilih/buat PRD → simpan kutipan snapshot. PRD menampilkan 'Ide terkait' di paling bawah: kutipan, 'Ide oleh X · versi terakhir Y', tanda 'Sumber sudah diedit', link ke ide, hapus kutipan.

## Blocked by
04, 06

## Status
done (kode) — uji SQL todo HP belum

## Acceptance criteria
- [ ] SQL: tidak bisa mengutip draft / ide tim lain
- [ ] Unit: pemecah paragraf, deteksi berubah, atribusi
- [ ] HP: satu ide masuk ke dua PRD; edit ide → tanda muncul

## Verifikasi RLS
2026-10-27: `supabase/tests/03_revisions_prd.check.sql` dijalankan di project produksi lewat SQL Editor, 21 lolos, 0 gagal.
