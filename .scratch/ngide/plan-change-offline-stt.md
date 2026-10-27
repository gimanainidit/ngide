# Plan change: transkripsi offline (whisper.cpp) + batas rekam 2 menit

Status: DISEPAKATI, belum diimplementasi. Menggantikan default lama "maks 10 menit" dan "transkrip mentah saja".

## Keputusan
| # | Keputusan | Arti teknis |
|---|---|---|
| 1 | User memilih mode transkripsi | Pengaturan per HP: **Cloud + cadangan lokal** (default) atau **Selalu lokal** |
| 2 | Ukuran app/data wajar seperti game mobile, target HP 8 GB RAM / 128 GB ROM | Model Whisper kelas `small` default, opsi kualitas tinggi `large-v3-turbo` terkuantisasi; diunduh, tidak dibundel |
| 3 | Transkrip ulang saat online | Mode cadangan: server mentranskrip ulang audio dengan Groq Whisper lalu dirapikan LLM |
| 4 | Rekaman maks **2 menit** | Ditegakkan di app (auto-stop) dan di server (tolak yang lebih panjang) |

Mesin lokal: **whisper.cpp via `whisper.rn`** (bukan sherpa-onnx; alasan: kualitas Bahasa Indonesia dan kematangan binding React Native). LLM lokal: **tidak** di fase ini (roadmap).

## Perilaku per mode
| | Cloud + cadangan lokal (default) | Selalu lokal |
|---|---|---|
| Transkripsi utama | Groq Whisper di server | whisper.cpp di HP |
| Offline / Groq gagal | whisper.cpp di HP → draft lokal | (sama, selalu lokal) |
| Audio ke cloud | Ya, bucket privat milik pembuat | **Tidak pernah**; audio hanya di HP (putar ulang hanya di HP itu) |
| Saat sync | Server transkrip ulang dengan Groq + rapikan LLM | Hanya teks transkrip lokal dikirim; dirapikan LLM cloud (bisa dimatikan) |
| Hasil vs editan user | Kalau draft sudah diedit, hasil server jadi **saran**, tidak menimpa | sama |

Catatan: di mode Selalu lokal, teks tetap dikirim ke server (untuk disimpan dan dibagikan ke tim) dan, kalau perapian aktif, ke LLM cloud. Itu dijelaskan di layar pengaturan.

## Batas 2 menit
- App: `MAX_MS = 120_000`, timer menampilkan sisa waktu, getar + auto-stop di 2:00, rekaman tetap diproses.
- Server: `check (duration_ms <= 125000)` di `recordings`; Edge Function menolak audio yang lebih panjang; batas ukuran bucket diturunkan dari 25 MB ke 5 MB (2 menit pada 48 kbps sekitar 0,7 MB).
- Efek: transkripsi lokal cukup satu kali proses (tanpa logika potong per 30 detik di app), waktu tunggu pendek.

## Model lokal (perkiraan, wajib diukur ulang di tiket benchmark)
| Pilihan | Unduhan | RAM saat jalan | Untuk |
|---|---|---|---|
| Standar: `small` q5 | ~200 MB | ~0,5–1 GB | default, semua HP target |
| Kualitas tinggi: `large-v3-turbo` q5 | ~550–800 MB | ~1,5–2 GB | HP ≥ 6 GB RAM |
- Diunduh setelah user memilih mode lokal atau mengaktifkan cadangan; hanya via Wi-Fi (bisa dipaksa), verifikasi SHA-256, bisa dihapus.
- Gerbang kemampuan: arm64 saja; `large-v3-turbo` hanya ditawarkan bila RAM ≥ 6 GB.
- Target: rekaman 2 menit selesai ditranskrip lokal ≤ 30 detik di HP 8 GB (diukur, bukan diasumsikan).
- Modul native → butuh build APK (bukan Expo Go). Tambahan ukuran APK dari library native beberapa MB per ABI; build hanya arm64-v8a.

## Arsitektur
```
[Rekam ≤2 mnt] → audio + entri antrean (SQLite lokal)
  Mode cadangan:
    online & Groq sehat → upload → server: Groq STT → rapikan LLM → ide draft
    offline / Groq gagal → whisper lokal → draft lokal
        → saat online: upload audio + transkrip lokal → server transkrip ulang (Groq) → rapikan → ide
  Mode selalu lokal:
    whisper lokal → draft lokal → saat online: kirim TEKS saja → server rapikan → ide
```
- App: interface `Transcriber` (`CloudTranscriber`, `LocalWhisperTranscriber`) + satu modul kebijakan `chooseTranscriber(mode, online, groqHealthy, modelReady)` yang murni dan dites.
- Antrean: `recorded → local_transcribed? → synced → server_done`, plus `failed_retryable` / `failed_permanent`; idempoten via UUID rekaman dari klien; backoff eksponensial.
- Server tetap satu-satunya pembuat ide (RLS tidak berubah). `transcribe` menerima `local_transcript`, `source`, `mode`; tidak pernah gagal total bila transkrip lokal ada (perapian ditandai `pending`).
- Server: daftar provider STT dari secret (`STT_PROVIDERS=groq,...`); 4xx tidak diulang, 429/5xx diulang lalu pindah provider; job pg_cron merapikan ulang yang `pending`.

## Perubahan data
- `recordings`: `transcript_source` (`groq`/`local-whisper`/...), `stt_model`, `polish_status` (`none`/`pending`/`done`/`suggested`/`skipped`), `audio_path` jadi **nullable** (mode selalu lokal), constraint durasi.
- `ideas`: `suggested_title`, `suggested_body_md` (saran versi rapi bila draft sudah diedit).

## Tiket (urut dependensi)
Lihat `issues/09`–`14`. Ringkas:
- 09 Batas rekam 2 menit (—)
- 05 Antrean offline (sudah ada; kini jadi fondasi)
- 10 Provider STT + kolom sumber/status di server (09)
- 11 Pengaturan mode + pengelola model (05)
- 12 Transkripsi lokal whisper.rn → draft lokal (05, 11)
- 13 Sync + transkrip ulang + saran tanpa menimpa (10, 12)
- 14 Provider STT kedua + job perapian ulang (10)
- Roadmap: LLM lokal untuk perapian offline (dievaluasi setelah 12, dengan anggaran ukuran yang sama)

## Pengujian
- Unit: `chooseTranscriber`, state machine antrean, aturan tidak menimpa editan, validasi durasi.
- pgTAP: constraint durasi, `audio_path` null hanya untuk pemilik, kolom saran hanya ditulis server.
- Benchmark: 10 rekaman Bahasa Indonesia campur English (≤ 2 menit): WER dan waktu proses Groq vs `small` vs `large-v3-turbo` di HP 8 GB dan emulator.

## Yang belum diverifikasi
Versi `whisper.rn`, kompatibilitasnya dengan Expo SDK 58 / React Native 0.88, ukuran file model, dan angka RAM di atas berasal dari ingatan, bukan dokumentasi terkini. Tiket 11/12 dimulai dengan mengecek itu.
