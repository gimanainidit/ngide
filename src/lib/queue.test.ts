import { describe, expect, it } from 'vitest';
import { backoffMs, classifyError, editLocalDraft, isDue, newItem, onFailure, onLocalTranscribed, onSynced } from './queue';

const now = 1_000_000;
const item = () => newItem({ id: 'r1', uri: 'file:///r1.wav', durationMs: 30_000, now, mode: 'cloud', polish: true });

describe('queue', () => {
  it('item baru langsung jatuh tempo', () => {
    expect(item()).toMatchObject({ stage: 'recorded', attempts: 0, uploaded: false, inserted: false, cloudFailures: 0 });
    expect(isDue(item(), now)).toBe(true);
  });

  it('backoff eksponensial, maksimal 10 menit', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([5_000, 10_000, 20_000, 40_000]);
    expect(backoffMs(20)).toBe(600_000);
  });

  it('gagal sementara: attempts naik, jadwal mundur, belum jatuh tempo', () => {
    const failed = onFailure(item(), { permanent: false, message: 'offline', cloud: true }, now);
    expect(failed).toMatchObject({ stage: 'recorded', attempts: 1, nextAttemptAt: now + 5_000, lastError: 'offline', cloudFailures: 1 });
    expect(isDue(failed, now + 4_999)).toBe(false);
    expect(isDue(failed, now + 5_000)).toBe(true);
  });

  it('gagal permanen: berhenti', () => {
    const failed = onFailure(item(), { permanent: true, message: 'Rekaman lebih dari 2 menit' }, now);
    expect(failed.stage).toBe('failed_permanent');
    expect(isDue(failed, now + 10 ** 9)).toBe(false);
  });

  it('transkrip lokal jadi draft lokal', () => {
    const t = onLocalTranscribed(item(), { transcript: 'Halo.', model: 'small-q5_1', title: 'Ide 1', body_md: 'Halo.' }, now);
    expect(t).toMatchObject({ stage: 'local_transcribed', local: { edited: false, title: 'Ide 1' }, attempts: 0 });
  });

  it('edit draft lokal menandai edited; tidak berlaku sebelum ada draft', () => {
    const t = onLocalTranscribed(item(), { transcript: 'Halo.', model: 'm', title: 'Ide 1', body_md: 'Halo.' }, now);
    expect(editLocalDraft(t, 'Judulku', 'Isi')).toMatchObject({ local: { edited: true, title: 'Judulku', body_md: 'Isi', transcript: 'Halo.' } });
    expect(editLocalDraft(item(), 'x', 'y')).toEqual(item());
  });

  it('sync sukses → server_done dengan ideaId', () => {
    expect(onSynced(item(), 'idea-1')).toMatchObject({ stage: 'server_done', ideaId: 'idea-1', lastError: undefined });
  });

  it('klasifikasi error klien', () => {
    expect(classifyError(400)).toBe('permanent');
    expect(classifyError(404)).toBe('permanent');
    expect(classifyError(413)).toBe('permanent');
    expect(classifyError(422)).toBe('permanent');
    expect(classifyError(401)).toBe('retryable');
    expect(classifyError(409)).toBe('reupload');
    expect(classifyError(502)).toBe('retryable');
    expect(classifyError(undefined)).toBe('retryable');
  });
});
