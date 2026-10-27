# Edit tim + riwayat (hanya baca)

## What to build
Anggota tim mengedit ide shared. Trigger mencatat revisi (append-only) dengan editor; original_title disimpan saat share. Label 'Ide asli: X · diedit Y waktu'. Layar Riwayat: versi asli + daftar revisi (siapa, kapan, isi), hanya baca. Simpan memakai syarat updated_at; bentrok → pesan + muat ulang.

## Blocked by
03

## Status
todo

## Acceptance criteria
- [ ] SQL: edit B pada ide shared A membuat 1 revisi dengan editor B
- [ ] SQL: klien tidak bisa insert/update/delete revisi; draft tidak membuat revisi
- [ ] Unit: label atribusi; bentrok terdeteksi (update 0 baris)
- [ ] HP: B edit ide A, A melihat label & riwayat
