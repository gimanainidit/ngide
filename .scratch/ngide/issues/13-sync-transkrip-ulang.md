# Sync, transkrip ulang, saran tanpa menimpa

## What to build
Saat online: mode cadangan upload audio + transkrip lokal → server transkrip ulang dengan Groq + rapikan; mode Selalu lokal kirim teks saja. Bila draft sudah diedit user, hasil server disimpan sebagai saran (suggested_*) dan app menampilkan 'Versi rapi tersedia'.

## Blocked by
10, 12

## Status
done (kode) — uji di HP belum

## Acceptance criteria
- [ ] Mode Selalu lokal: tidak ada objek audio di storage (pgTAP/cek)
- [ ] Editan user tidak pernah tertimpa (unit + pgTAP)
