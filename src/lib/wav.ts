// WAV PCM16: parse, tulis, dan normalisasi ke 16 kHz mono untuk whisper.cpp. Pure.
export const WHISPER_RATE = 16000;

export type Wav = { sampleRate: number; channels: number; samples: Int16Array };

function readTag(view: DataView, offset: number) {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

export function parseWav(bytes: Uint8Array): Wav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || readTag(view, 0) !== 'RIFF' || readTag(view, 8) !== 'WAVE') {
    throw new Error('Bukan file WAV');
  }
  let sampleRate = 0;
  let channels = 0;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const tag = readTag(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (tag === 'fmt ') {
      const format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      const bits = view.getUint16(body + 14, true);
      if (format !== 1 || bits !== 16) throw new Error('Bukan file WAV PCM 16-bit');
    } else if (tag === 'data') {
      if (!sampleRate) throw new Error('Bukan file WAV');
      const length = Math.min(size, bytes.byteLength - body) >> 1;
      const samples = new Int16Array(length);
      for (let i = 0; i < length; i++) samples[i] = view.getInt16(body + i * 2, true);
      return { sampleRate, channels, samples };
    }
    offset = body + size + (size & 1);
  }
  throw new Error('Bukan file WAV');
}

export function encodeWav(samples: Int16Array, sampleRate: number, channels: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  tag(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return bytes;
}

export function wavDurationMs(bytes: Uint8Array): number {
  const { sampleRate, channels, samples } = parseWav(bytes);
  return Math.round((samples.length / channels / sampleRate) * 1000);
}

// Downmix ke mono lalu resample ke 16 kHz (rata-rata per jendela = low-pass sederhana, cukup untuk suara).
export function toWhisperWav(bytes: Uint8Array): Uint8Array {
  const { sampleRate, channels, samples } = parseWav(bytes);
  if (sampleRate === WHISPER_RATE && channels === 1) return bytes;

  const frames = Math.floor(samples.length / channels);
  const mono = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[f * channels + c];
    mono[f] = sum / channels;
  }

  const ratio = sampleRate / WHISPER_RATE;
  const outLength = Math.round(frames / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = i * ratio;
    const end = Math.min(frames, start + Math.max(ratio, 1));
    let sum = 0;
    let count = 0;
    for (let j = Math.floor(start); j < Math.ceil(end); j++) {
      sum += mono[Math.min(j, frames - 1)];
      count++;
    }
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sum / Math.max(count, 1))));
  }
  return encodeWav(out, WHISPER_RATE, 1);
}
