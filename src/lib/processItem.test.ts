import { describe, expect, it, vi } from 'vitest';
import { processItem, SyncError, type Deps } from './processItem';
import { editLocalDraft, newItem, onLocalTranscribed } from './queue';

const now = 1_000_000;
const cloud = () => newItem({ id: '11111111-1111-4111-8111-111111111111', uri: 'file:///a.wav', durationMs: 30_000, now, mode: 'cloud', polish: true });
const local = () => ({ ...cloud(), mode: 'local' as const });

function deps(over: Partial<Deps> = {}): Deps {
  return {
    now: () => now,
    transcribeLocal: vi.fn(async () => ({ text: 'Ide lokal.', model: 'small-q5_1' })),
    uploadAudio: vi.fn(async () => 'u1/a.wav'),
    insertRecording: vi.fn(async () => {}),
    invoke: vi.fn(async () => ({ ideaId: 'idea-1' })),
    ...over,
  };
}

describe('processItem', () => {
  it('cloud online: upload → insert → invoke → selesai', async () => {
    const d = deps();
    const out = await processItem(cloud(), { online: true, modelReady: false }, d);
    expect(out).toMatchObject({ stage: 'server_done', ideaId: 'idea-1', uploaded: true, inserted: true });
    expect(d.insertRecording).toHaveBeenCalledWith(expect.anything(), 'u1/a.wav');
    expect(d.invoke).toHaveBeenCalledWith({ recording_id: cloud().id, mode: 'cloud', polish: true });
  });

  it('cloud offline + model siap → draft lokal, belum ada panggilan jaringan', async () => {
    const d = deps();
    const out = await processItem(cloud(), { online: false, modelReady: true }, d);
    expect(out).toMatchObject({ stage: 'local_transcribed', local: { transcript: 'Ide lokal.', model: 'small-q5_1', edited: false } });
    expect(out.local!.title).toMatch(/^Ide /);
    expect(d.uploadAudio).not.toHaveBeenCalled();
  });

  it('cloud: sync membawa transkrip lokal & editan user', async () => {
    const d = deps();
    const t = editLocalDraft(onLocalTranscribed(cloud(), { transcript: 'T.', model: 'm', title: 'x', body_md: 'T.' }, now), 'Judulku', 'Isi');
    await processItem(t, { online: true, modelReady: true }, d);
    expect(d.invoke).toHaveBeenCalledWith({
      recording_id: t.id,
      mode: 'cloud',
      polish: true,
      local_transcript: 'T.',
      local_model: 'm',
      local_title: 'Judulku',
      local_body: 'Isi',
      local_edited: true,
    });
  });

  it('mode lokal: tidak pernah upload audio, insert dengan audio null', async () => {
    const d = deps();
    const t = await processItem(local(), { online: true, modelReady: true }, d);
    const out = await processItem(t, { online: true, modelReady: true }, d);
    expect(d.uploadAudio).not.toHaveBeenCalled();
    expect(d.insertRecording).toHaveBeenCalledWith(expect.anything(), null);
    expect(out.stage).toBe('server_done');
  });

  it('upload sudah berhasil tidak diulang saat retry', async () => {
    const d = deps({ invoke: vi.fn().mockRejectedValueOnce(new SyncError('down', 502)).mockResolvedValueOnce({ ideaId: 'i' }) });
    const first = await processItem(cloud(), { online: true, modelReady: false }, d);
    expect(first).toMatchObject({ stage: 'recorded', uploaded: true, inserted: true, attempts: 1, cloudFailures: 1 });
    await processItem({ ...first, nextAttemptAt: now }, { online: true, modelReady: false }, d);
    expect(d.uploadAudio).toHaveBeenCalledTimes(1);
    expect(d.insertRecording).toHaveBeenCalledTimes(1);
  });

  it('upload berhasil tapi insert gagal → retry insert memakai path audio yang sama', async () => {
    const d = deps({ insertRecording: vi.fn().mockRejectedValueOnce(new SyncError('jaringan putus')).mockResolvedValueOnce(undefined) });
    const first = await processItem(cloud(), { online: true, modelReady: false }, d);
    expect(first).toMatchObject({ uploaded: true, inserted: false, audioPath: 'u1/a.wav' });
    await processItem({ ...first, nextAttemptAt: now }, { online: true, modelReady: false }, d);
    expect(d.uploadAudio).toHaveBeenCalledTimes(1);
    expect(d.insertRecording).toHaveBeenLastCalledWith(expect.anything(), 'u1/a.wav');
  });

  it('409 (audio hilang di server) → upload ulang di percobaan berikutnya', async () => {
    const d = deps({ invoke: vi.fn(async () => { throw new SyncError('Audio belum ter-upload', 409); }) });
    const out = await processItem(cloud(), { online: true, modelReady: false }, d);
    expect(out).toMatchObject({ uploaded: false, stage: 'recorded', attempts: 1 });
  });

  it('422 → gagal permanen', async () => {
    const d = deps({ invoke: vi.fn(async () => { throw new SyncError('Tidak ada suara terdeteksi', 422); }) });
    expect((await processItem(cloud(), { online: true, modelReady: false }, d)).stage).toBe('failed_permanent');
  });

  it('mode lokal: hening (transkrip kosong) → gagal permanen', async () => {
    const d = deps({ transcribeLocal: vi.fn(async () => ({ text: '  ', model: 'm' })) });
    const out = await processItem(local(), { online: false, modelReady: true }, d);
    expect(out).toMatchObject({ stage: 'failed_permanent', lastError: 'Tidak ada suara terdeteksi' });
  });

  it('cloud: transkripsi lokal gagal → tetap recorded, menunggu cloud', async () => {
    const d = deps({ transcribeLocal: vi.fn(async () => { throw new Error('model rusak'); }) });
    const out = await processItem(cloud(), { online: false, modelReady: true }, d);
    expect(out).toMatchObject({ stage: 'recorded', attempts: 1, lastError: 'model rusak' });
  });

  it('item belum jatuh tempo tidak diproses', async () => {
    const d = deps();
    const later = { ...cloud(), nextAttemptAt: now + 1 };
    expect(await processItem(later, { online: true, modelReady: true }, d)).toBe(later);
    expect(d.invoke).not.toHaveBeenCalled();
  });

  it('menunggu model / online → item tidak berubah', async () => {
    const d = deps();
    const it1 = local();
    expect(await processItem(it1, { online: true, modelReady: false }, d)).toBe(it1);
  });
});
