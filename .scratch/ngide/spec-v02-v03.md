# Spec: v0.2–v0.3 — Edit tim + riwayat, PRD, kutipan, export

Status: DISEPAKATI (grilling 27 Okt 2026). Tiket 05 sudah selesai di plan change offline.

## Problem Statement
Ide yang sudah dibagikan perlu disempurnakan bersama tanpa menghapus jejak pemilik asli. Kumpulan ide lalu perlu disusun menjadi PRD per produk yang rapi, dengan asal-usul ide tetap terlacak, dan bisa dibawa keluar app sebagai file Markdown.

## Solution
- Anggota tim bisa mengedit ide yang dibagikan; setiap perubahan tercatat dan bisa dilihat di layar Riwayat (hanya baca).
- Tab PRD: anggota tim menulis PRD dalam markdown bebas, lalu bisa meminta LLM menyusunnya ke format standar. Hasilnya tetap bisa diedit bebas.
- Paragraf dari ide bisa dikutip ke satu atau beberapa PRD. Kutipan berupa snapshot; kalau ide sumbernya diedit, kutipan diberi tanda.
- PRD bisa diekspor ke file `.md` lewat share sheet.
- Update OTA supaya perubahan berikutnya tidak perlu install APK ulang.

## User Stories
1. Sebagai anggota tim, saya bisa mengedit ide yang sudah dibagikan oleh orang lain.
2. Sebagai pemilik ide, saya melihat "Ide asli: saya · diedit Budi 2 jam lalu" agar tahu ide saya diubah.
3. Sebagai anggota tim, saya membuka Riwayat untuk membaca versi asli dan setiap revisi (siapa, kapan, isi).
4. Sebagai anggota tim, saya diberi tahu kalau ide yang saya edit baru saja diubah orang lain, supaya editan tidak saling menimpa diam-diam.
5. Sebagai anggota tim, saya membuat PRD baru dan menulis isinya dalam markdown bebas.
6. Sebagai anggota tim, saya menekan "Susun jadi PRD standar (AI)" dan mendapat draf dengan bagian Latar masalah, Nama solusi, Fitur utama, Fitur tambahan, Out of scope; saya pratinjau dulu sebelum memakainya.
7. Sebagai anggota tim, saya memilih paragraf dari ide yang dibagikan lalu menambahkannya ke PRD.
8. Sebagai pembaca PRD, saya melihat ide terkait di paling bawah, lengkap dengan pembuat ide dan pembuat versi terakhirnya.
9. Sebagai pembaca PRD, saya melihat tanda "Sumber sudah diedit" kalau ide sumber berubah setelah dikutip.
10. Sebagai anggota tim, saya mengekspor PRD ke file `.md` dan membagikannya ke aplikasi lain.
11. Sebagai pengguna, app saya memperbarui diri saat dibuka tanpa install APK baru.

## Implementation Decisions
- **Revisi**: tabel `idea_revisions` append-only, diisi trigger `AFTER UPDATE` pada ide berstatus `shared` saat judul/isi berubah; penulisnya = `updated_by`. `original_title` disimpan saat share (melengkapi `original_md`). Klien tidak punya policy insert/update/delete.
- **Bentrok edit**: optimistic concurrency — update memakai syarat `updated_at` yang dimuat; 0 baris = bentrok → pesan "Ide ini baru diubah {nama}, muat ulang".
- **PRD**: tabel `prds` (CRUD anggota tim; hapus hanya pembuat). Standarisasi lewat Edge Function baru `prd` (aksi `standardize`): baca PRD + kutipan via RLS pemanggil, panggil LLM Groq, kembalikan markdown; klien menampilkan pratinjau, pengguna memilih Pakai/Batal. Tidak pernah menimpa otomatis.
- **Kutipan**: tabel `prd_excerpts` (snapshot `quote_md`, `idea_updated_at` saat dikutip, `added_by`, `position`). Insert hanya bila ide `shared` dan satu tim dengan PRD. "Berubah" = `ideas.updated_at > idea_updated_at`. Pemilihan per paragraf (dipisah baris kosong).
- **Atribusi**: "Ide oleh {author} · versi terakhir {updated_by ?? author}".
- **Export**: fungsi murni `buildPrdMarkdown(prd, excerpts)` → file di cache → `expo-sharing`.
- **OTA**: `expo-updates`, channel `preview`, runtime version = versi app.

## Testing Decisions
- pgTAP-gaya (SQL rollback di Supabase): revisi tercatat & append-only, bentrok terdeteksi, RLS PRD/kutipan (bukan anggota ditolak, ide draft/tim lain tidak bisa dikutip, hapus PRD hanya pembuat).
- Unit (vitest): pemecah paragraf, deteksi kutipan berubah, atribusi, pembangun prompt & parser standarisasi PRD, exporter markdown, slug nama file, Edge Function `prd` dengan LLM palsu.
- Manual di HP: dua akun (A, B) menjalankan alur 1–11.

## Out of Scope
Pulihkan versi lama (riwayat hanya baca), diff berwarna antar versi, komentar, kolaborasi real-time, export PDF, ikon app final (butuh aset dari tim).

## Further Notes
Butuh satu build APK lagi (expo-sharing & expo-updates adalah modul native). Setelah itu perubahan JS cukup lewat `eas update`.
