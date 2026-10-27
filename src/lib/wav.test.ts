import { describe, expect, it } from 'vitest';
import { encodeWav, parseWav, toWhisperWav, wavDurationMs } from './wav';

function sine(rate: number, channels: number, seconds: number): Int16Array {
  const n = Math.round(rate * seconds);
  const out = new Int16Array(n * channels);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 10000);
    for (let c = 0; c < channels; c++) out[i * channels + c] = v;
  }
  return out;
}

describe('wav', () => {
  it('encode → parse bolak-balik', () => {
    const samples = sine(16000, 1, 0.5);
    const parsed = parseWav(encodeWav(samples, 16000, 1));
    expect(parsed).toMatchObject({ sampleRate: 16000, channels: 1 });
    expect(parsed.samples).toEqual(samples);
  });

  it('16 kHz mono dikembalikan apa adanya', () => {
    const bytes = encodeWav(sine(16000, 1, 1), 16000, 1);
    expect(toWhisperWav(bytes)).toBe(bytes);
  });

  it('48 kHz stereo → 16 kHz mono dengan durasi sama', () => {
    const out = parseWav(toWhisperWav(encodeWav(sine(48000, 2, 2), 48000, 2)));
    expect(out.sampleRate).toBe(16000);
    expect(out.channels).toBe(1);
    expect(out.samples.length).toBe(32000);
    // sinyal tetap ada (tidak jadi hening)
    expect(Math.max(...Array.from(out.samples.slice(0, 2000)))).toBeGreaterThan(8000);
  });

  it('44.1 kHz → 16 kHz (rasio tidak bulat)', () => {
    const out = parseWav(toWhisperWav(encodeWav(sine(44100, 1, 1), 44100, 1)));
    expect(out.samples.length).toBe(16000);
  });

  it('durasi dari header', () => {
    expect(wavDurationMs(encodeWav(sine(16000, 1, 2.5), 16000, 1))).toBe(2500);
  });

  it('melewati chunk selain fmt/data', () => {
    const base = encodeWav(sine(16000, 1, 0.1), 16000, 1);
    // sisipkan chunk LIST 4 byte setelah fmt (offset 36)
    const extra = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 4, 0, 0, 0, 1, 2, 3, 4]);
    const bytes = new Uint8Array(base.length + extra.length);
    bytes.set(base.subarray(0, 36));
    bytes.set(extra, 36);
    bytes.set(base.subarray(36), 36 + extra.length);
    expect(parseWav(bytes).samples.length).toBe(1600);
  });

  it('bukan WAV PCM16 → error', () => {
    expect(() => parseWav(new Uint8Array([1, 2, 3]))).toThrow('Bukan file WAV');
  });
});
