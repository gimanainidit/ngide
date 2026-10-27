// Daftar model whisper.cpp dan gerbang kemampuan HP. Pure.
export type ModelId = 'small' | 'turbo';

export type ModelInfo = {
  id: ModelId;
  label: string;
  file: string;
  url: string;
  approxBytes: number;
  minRamBytes: number;
  description: string;
};

const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
const MB = 1024 * 1024;

export const MODELS: ModelInfo[] = [
  {
    id: 'small',
    label: 'Standar',
    file: 'ggml-small-q5_1.bin',
    url: `${HF}ggml-small-q5_1.bin`,
    approxBytes: 181 * MB,
    minRamBytes: 2.5e9, // kelas HP 3 GB
    description: 'Seimbang: cepat, akurasi cukup untuk catatan ide.',
  },
  {
    id: 'turbo',
    label: 'Kualitas tinggi',
    file: 'ggml-large-v3-turbo-q5_0.bin',
    url: `${HF}ggml-large-v3-turbo-q5_0.bin`,
    approxBytes: 547 * MB,
    minRamBytes: 5.2e9, // kelas HP 6 GB
    description: 'Lebih akurat untuk Indonesia-English campur, butuh RAM besar.',
  },
];

export function modelInfo(id: ModelId): ModelInfo {
  return MODELS.find((m) => m.id === id)!;
}

export function availableModels(device: { totalMemory: number | null; abis: string[] | null }) {
  const arm64 = device.abis?.includes('arm64-v8a') ?? false;
  return MODELS.map((m) => {
    if (!arm64) return { ...m, allowed: false, reason: 'Hanya untuk HP 64-bit ARM' };
    if (device.totalMemory === null) {
      return m.id === 'small' ? { ...m, allowed: true } : { ...m, allowed: false, reason: 'RAM HP tidak diketahui' };
    }
    if (device.totalMemory < m.minRamBytes) return { ...m, allowed: false, reason: 'RAM HP tidak cukup' };
    return { ...m, allowed: true };
  });
}

// Null bila unduhan utuh; selain itu alasan penolakan.
export function verifyDownload(p: { expectedBytes: number | null; actualBytes: number; approxBytes: number }): string | null {
  if (p.expectedBytes !== null) {
    return p.actualBytes === p.expectedBytes ? null : 'Unduhan tidak lengkap, coba lagi';
  }
  return p.actualBytes >= p.approxBytes * 0.8 ? null : 'Unduhan tidak lengkap, coba lagi';
}
