# Handoff Ngide: dari sesi cloud ke komputer lokal

Ditulis 2026-10-27. Kode terakhir ada di `main` di https://github.com/gimanainidit/ngide.

## 1. Sambungkan folder lokal ke GitHub (pull dulu)

Folder `C:\Users\harai\git\ngide-source\ngide` berasal dari zip, jadi belum punya `.git` dan isinya lebih lama dari `main`. Sambungkan folder itu ke remote, lalu samakan isinya dengan `main` sebelum mengubah apa pun.

PowerShell:

```powershell
cd C:\Users\harai\git\ngide-source\ngide

# Cadangkan dulu kalau pernah mengubah sesuatu di folder ini
Copy-Item . ..\ngide-backup -Recurse -Exclude node_modules

git init -b main
git remote add origin https://github.com/gimanainidit/ngide.git
git fetch origin main

# Jadikan origin/main sebagai acuan tanpa menghapus file di folder
git reset origin/main
git branch --set-upstream-to=origin/main main

# Lihat apa yang beda dengan versi zip
git status

# Kalau perubahan lokal tidak perlu disimpan, ambil versi main sepenuhnya:
git restore .
git clean -n    # pratinjau file lama yang tidak ada di repo; hapus dengan -f bila yakin

git pull        # mulai sekarang: selalu pull dulu sebelum kerja
```

File yang tidak masuk git dan harus tetap ada di lokal:
- `.env.local` berisi `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nilainya sama dengan yang ada di `eas.json`. Contoh formatnya di `.env.example`.
- `node_modules/` dibuat ulang dengan `npm install`.

Setelah itu:

```powershell
npm install
npx tsc --noEmit
npx eslint .
npx vitest run           # harus 170 tes lolos
```

Alur kerja: `git pull` → ubah → cek di atas → commit → `git push`. Push langsung ke `main` sesuai kesepakatan.

## 2. Status

| Bagian | Status |
|---|---|
| v0.1 login Google, rekam, transkrip, share | Selesai, sudah diuji di HP |
| Offline STT (whisper.rn), batas 2 menit, transkrip ulang + polish | Selesai, sudah diuji di HP |
| v0.2 edit tim + riwayat, antrean offline | Selesai di kode; RLS 21/21 lolos; **belum diuji di HP** |
| v0.3 PRD + standarisasi AI, kutip, export `.md` | Selesai di kode; RLS lolos; **belum diuji di HP** |
| T20–T21 tema Triad PRO-TX, "ide meledak", ikon & splash | Selesai di kode (versi 1.1.0); **belum diuji di HP** |

Tiket ada di `.scratch/ngide/issues/01–21`. Spec ada di `.scratch/ngide/spec.md`, `spec-v02-v03.md`, `plan-change-offline-stt.md`, dan `ota.md`.

## 3. Langkah berikutnya

1. **Build APK 1.1.0.** Wajib build, update OTA saja tidak cukup, karena ada modul native baru: react-native-svg, expo-haptics, expo-splash-screen, expo-font, expo-system-ui.
   ```powershell
   npx eas-cli@latest build -p android --profile preview
   ```
2. **Uji di HP dengan 2 akun** (misalnya Labib dan Jiwa):
   - B mengedit ide yang dibagikan A, lalu A membuka Riwayat. Cek juga bentrok edit.
   - Buat PRD, tekan "Susun ulang (AI)", kutip paragraf, edit ide sumbernya, lalu cek badge "Sumber sudah diedit". Export `.md`.
   - Coba tampilan terang dan gelap (setelan HP), animasi saat mulai rekam, ikon dan splash.
3. **Setelah APK 1.1.0 terpasang**, perubahan yang hanya JS cukup dikirim lewat OTA:
   ```powershell
   npx eas-cli@latest update --channel preview --message "..."
   ```
   Kalau ada modul native baru atau versi di `app.json` naik, build APK lagi (`runtimeVersion` mengikuti `appVersion`).

## 4. Peta teknis

- **Stack:** Expo SDK 58 (RN 0.88, React 19.3, `react-dom` dikunci 19.3.0), Expo Router (rute di `app/`), EAS Build/Update. Baca `AGENTS.md`: selalu cek docs Expo versi 58, dan pakai `npx expo install` untuk paket baru.
- **Supabase:**
  - Project ref `qsgbmkcpjpgimmmqzxup`.
  - Migrasi ada di `supabase/migrations/`.
  - Edge Functions: `transcribe` (rantai Groq turbo → large → OpenAI opsional, plus polish) dan `prd` (standarisasi 5 bagian).
  - Secret functions: `GROQ_API_KEY`, opsional `OPENAI_API_KEY`, `GROQ_CHAT_MODEL`, `GROQ_PRD_MODEL`, `STT_PROVIDERS`. Semuanya diatur di Dashboard, jangan dimasukkan ke repo.
  - Job pg_cron `ngide-polish-pending` jalan tiap 15 menit. Secret-nya disimpan di Vault.
- **Auth:**
  - Google PKCE, redirect `ngide://auth-callback`.
  - Allowlist tim ada di tabel `team_allowlist`: labibeduph, jiwa2.pra, erlgptr.
- **Tes RLS:** `supabase/tests/*.sql`. Untuk `03_revisions_prd.check.sql`, tempel seluruh isinya di SQL Editor lalu Run. Hasilnya muncul sebagai "error" `HASIL: N lolos, M gagal`, dan semua data uji di-rollback.
- **Tema:**
  - Token warna di `src/theme/tokens.ts`. Tes kontras di `tokens.test.ts`, minimal 4.5:1 untuk mode terang dan gelap.
  - Komponen UI ada di `src/ui/`.
  - Ikon lucide **wajib** diimpor lewat `src/ui/icons.ts`, satu file per ikon. Font diimpor per ketebalan. Metro tidak melakukan tree-shaking, jadi impor penuh membuat bundle membengkak (target ±3,8 MB).
- **Aturan desain:**
  - DM Serif hanya untuk ukuran 36px ke atas. Inter 400/500/600.
  - Radius tombol 8, kartu 12. Tidak ada tombol pill.
  - Satu tombol primary per layar. Warna merah hanya saat merekam.
  - Area sentuh minimal 48dp. Hormati setelan "kurangi gerakan".
- **Lint:** aturan react-hooks compiler aktif. Jangan baca ref saat render, dan jangan setState sinkron di dalam effect.

## 5. Catatan

- Snapshot data JSON sebelum migrasi v0.2 (`backups/snapshot-2026-10-27T0652Z.json`) hanya ada di container cloud dan tidak masuk repo karena berisi data pengguna. Snapshot baru bisa dibuat dari Dashboard kalau perlu.
- Plugin `ui-ux-pro-max` belum terpasang di lokal. Kalau mau dipakai: `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.
- Color Mood dan mockup layar ada di artifact claude.ai (Ngide Color Mood).
