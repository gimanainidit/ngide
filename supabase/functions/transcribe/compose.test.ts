import { describe, expect, it } from 'vitest';
import { composeIdea, decidePendingPolish } from './compose.ts';

const at = new Date('2026-10-26T15:41:00Z');
const polished = { title: 'Widget cepat', body_md: '- Buat **widget**' };

describe('composeIdea', () => {
  it('belum diedit + rapi → pakai versi rapi, done', () => {
    expect(composeIdea({ transcript: 'Buat widget.', at, polished, polishEnabled: true, local: null })).toEqual({
      title: 'Widget cepat',
      body_md: '- Buat **widget**',
      suggested_title: null,
      suggested_body_md: null,
      polish_status: 'done',
    });
  });

  it('perapian gagal → transkrip mentah, pending (dicoba ulang nanti)', () => {
    expect(composeIdea({ transcript: 'Buat widget.', at, polished: null, polishEnabled: true, local: null })).toMatchObject({
      title: 'Ide 26 Okt 22.41',
      body_md: 'Buat widget.',
      polish_status: 'pending',
    });
  });

  it('perapian dimatikan → skipped', () => {
    expect(composeIdea({ transcript: 'Buat widget.', at, polished: null, polishEnabled: false, local: null }).polish_status).toBe('skipped');
  });

  it('draft lokal sudah diedit → editan user dipakai, versi rapi jadi saran', () => {
    const local = { edited: true, title: 'Judulku', body_md: 'Isi editanku' };
    expect(composeIdea({ transcript: 'Buat widget.', at, polished, polishEnabled: true, local })).toEqual({
      title: 'Judulku',
      body_md: 'Isi editanku',
      suggested_title: 'Widget cepat',
      suggested_body_md: '- Buat **widget**',
      polish_status: 'suggested',
    });
  });

  it('draft lokal diedit tapi perapian gagal → editan tetap, pending', () => {
    const local = { edited: true, title: 'Judulku', body_md: 'Isi editanku' };
    expect(composeIdea({ transcript: 'x', at, polished: null, polishEnabled: true, local })).toMatchObject({
      body_md: 'Isi editanku',
      suggested_body_md: null,
      polish_status: 'pending',
    });
  });

  it('draft lokal tidak diedit → diperlakukan seperti belum ada draft', () => {
    const local = { edited: false, title: 'Lama', body_md: 'Lama' };
    expect(composeIdea({ transcript: 'Buat widget.', at, polished, polishEnabled: true, local }).body_md).toBe('- Buat **widget**');
  });

  it('judul editan kosong → judul otomatis', () => {
    const local = { edited: true, title: '  ', body_md: 'Isi' };
    expect(composeIdea({ transcript: 'x', at, polished: null, polishEnabled: false, local }).title).toBe('Ide 26 Okt 22.41');
  });
});

describe('decidePendingPolish', () => {
  it('draft yang belum disentuh manusia → ditimpa versi rapi', () => {
    expect(decidePendingPolish({ status: 'draft', updated_by: null }, polished, 0)).toEqual({
      kind: 'overwrite',
      polish_status: 'done',
    });
  });
  it('sudah diedit → saran', () => {
    expect(decidePendingPolish({ status: 'draft', updated_by: 'u1' }, polished, 0)).toEqual({ kind: 'suggest', polish_status: 'suggested' });
  });
  it('sudah dibagikan → saran (jangan ubah yang dibaca tim)', () => {
    expect(decidePendingPolish({ status: 'shared', updated_by: null }, polished, 0)).toEqual({ kind: 'suggest', polish_status: 'suggested' });
  });
  it('gagal lagi → tetap pending sampai 5 percobaan, lalu skipped', () => {
    expect(decidePendingPolish({ status: 'draft', updated_by: null }, null, 3)).toEqual({ kind: 'retry', polish_status: 'pending' });
    expect(decidePendingPolish({ status: 'draft', updated_by: null }, null, 4)).toEqual({ kind: 'give_up', polish_status: 'skipped' });
  });
  it('ide sudah diarsipkan → skipped', () => {
    expect(decidePendingPolish({ status: 'archived', updated_by: null }, polished, 0)).toEqual({ kind: 'give_up', polish_status: 'skipped' });
  });
});
