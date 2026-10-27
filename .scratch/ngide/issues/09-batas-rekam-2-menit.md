# Batas rekam 2 menit

## What to build
Rekaman dibatasi 2 menit: timer sisa waktu, getar dan auto-stop di 2:00, tetap diproses. Server menolak rekaman lebih panjang; batas bucket 5 MB.

## Blocked by
-

## Status
done (kode) — uji di HP belum

## Acceptance criteria
- [ ] Auto-stop tepat di 2:00 dan rekaman tetap jadi draft
- [ ] pgTAP: duration_ms > 125000 ditolak
- [ ] Edge Function menolak audio > 2 menit (tes mock)
