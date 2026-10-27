# Pengaturan mode transkripsi + pengelola model

## What to build
Layar pengaturan: Cloud + cadangan lokal (default) / Selalu lokal, toggle perapian LLM. Pengelola model: unduh (Wi-Fi), SHA-256, hapus, gerbang kemampuan (arm64, RAM). Mulai dengan verifikasi whisper.rn vs SDK 58.

## Blocked by
05

## Status
done (kode) — uji di HP belum

## Acceptance criteria
- [ ] Mode tersimpan per HP
- [ ] Unduhan bisa dilanjutkan/dibatalkan, checksum salah ditolak
- [ ] large-v3-turbo tidak ditawarkan di HP RAM < 6 GB
