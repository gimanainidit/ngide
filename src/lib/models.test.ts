import { describe, expect, it } from 'vitest';
import { availableModels, verifyDownload } from './models';

const GB = 1024 ** 3;

describe('availableModels', () => {
  it('HP 8 GB arm64: dua model', () => {
    const list = availableModels({ totalMemory: 7.6 * GB, abis: ['arm64-v8a', 'armeabi-v7a'] });
    expect(list.map((m) => [m.id, m.allowed])).toEqual([
      ['small', true],
      ['turbo', true],
    ]);
  });
  it('HP 4 GB: turbo tidak ditawarkan', () => {
    const turbo = availableModels({ totalMemory: 3.7 * GB, abis: ['arm64-v8a'] }).find((m) => m.id === 'turbo')!;
    expect(turbo).toMatchObject({ allowed: false });
    expect(turbo.reason).toContain('RAM');
  });
  it('bukan arm64: tidak ada model', () => {
    expect(availableModels({ totalMemory: 8 * GB, abis: ['x86_64'] }).every((m) => !m.allowed)).toBe(true);
  });
  it('RAM tidak diketahui: hanya small', () => {
    expect(availableModels({ totalMemory: null, abis: ['arm64-v8a'] }).map((m) => m.allowed)).toEqual([true, false]);
  });
});

describe('verifyDownload', () => {
  it('ukuran harus sama dengan Content-Length bila diketahui', () => {
    expect(verifyDownload({ expectedBytes: 1000, actualBytes: 1000, approxBytes: 1000 })).toBeNull();
    expect(verifyDownload({ expectedBytes: 1000, actualBytes: 999, approxBytes: 1000 })).toContain('tidak lengkap');
  });
  it('tanpa Content-Length: minimal 80% ukuran perkiraan', () => {
    expect(verifyDownload({ expectedBytes: null, actualBytes: 900, approxBytes: 1000 })).toBeNull();
    expect(verifyDownload({ expectedBytes: null, actualBytes: 100, approxBytes: 1000 })).toContain('tidak lengkap');
  });
});
