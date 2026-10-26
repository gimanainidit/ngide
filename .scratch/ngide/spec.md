# Spec: Ngide — voice-to-markdown idea notes

## Problem Statement
Ide muncul di momen acak dan hilang sebelum sempat diketik. Tim kecil (3 orang) butuh cara tercepat menangkap ide dengan suara, menyimpannya sebagai catatan markdown, lalu mengumpulkannya ke PRD produk.

## Solution
App Android: tap Rekam → ngomong → transkrip mentah jadi draft privat. Pembuat review lalu Share ke tim. Tim bisa mengedit dengan jejak pemilik asli, dan mengutip paragraf ke PRD.

## User Stories
1. Sebagai anggota tim, saya login dengan Google agar tidak mengelola password.
2. Sebagai orang di luar tim, saya ditolak saat login agar data tim aman.
3. Sebagai pembuat, saya tap Rekam dan bicara agar ide tertangkap cepat.
4. Sebagai pembuat, rekaman saya jadi draft teks markdown otomatis.
5. Sebagai pembuat, hanya saya yang bisa memutar audio dan melihat draft saya.
6. Sebagai pembuat, saya bisa edit draft lalu Share ke tim.
7. Sebagai anggota tim, saya melihat feed ide yang sudah di-share beserta pembuat aslinya.
8. Sebagai anggota tim, saya bisa mengedit ide yang di-share; versi asli dan riwayat edit tetap terlihat.
9. Sebagai pembuat, saya bisa merekam tanpa sinyal; upload otomatis nanti.
10. Sebagai anggota tim, saya membuat PRD per produk.
11. Sebagai anggota tim, saya mengutip paragraf ide ke satu atau beberapa PRD dengan asal-usul terlacak.
12. Sebagai anggota tim, saya mengekspor PRD sebagai file .md.

## Implementation Decisions
- Expo (React Native, TypeScript) + Supabase (Auth Google PKCE, Postgres+RLS, Storage privat, Edge Function `transcribe`).
- Transkrip: Groq whisper-large-v3-turbo, bahasa id. Kunci API hanya di secret server.
- Ide: draft → shared → archived. `original_md` dikunci saat share; edit setelah share dicatat di `idea_revisions` (append-only).
- Kutipan PRD = snapshot teks + link ke ide/author; satu ide bisa di banyak PRD.
- Tim: 1 tim di-seed, akses via allowlist email.
- recording_id dibuat di klien (UUID) agar upload/transkrip idempotent.

## Testing Decisions
- Seam utama: RLS Postgres (pgTAP), fungsi murni markdown/antrean/exporter (unit), Edge Function dengan Groq di-mock.
- Test perilaku eksternal saja, bukan implementasi.

## Out of Scope
AI rapikan/ringkas, widget quick-capture, multi-tim & undangan, pencarian, iOS, Play Store (roadmap).

## Further Notes
Lihat rencana lengkap di plan file; Play Store butuh closed testing 12 tester/14 hari untuk akun personal.
