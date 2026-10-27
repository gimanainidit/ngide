# Abstraksi provider STT di server

## What to build
Edge Function memakai daftar provider STT dari secret, klasifikasi error (4xx stop, 429/5xx retry lalu pindah), menerima local_transcript/source/mode, mencatat transcript_source/stt_model/polish_status. Tidak gagal total bila transkrip lokal ada.

## Blocked by
09

## Status
todo

## Acceptance criteria
- [ ] Tes mock: Groq down + local_transcript ada → ide tetap dibuat, polish pending
- [ ] Kolom baru terisi benar per jalur
