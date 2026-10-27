import { describe, expect, it } from 'vitest';
import { attributionLine, editedLabel, excerptChanged, splitParagraphs } from './attribution';

const now = new Date('2026-10-28T12:00:00Z').getTime();
const andi = { display_name: 'Andi', email: 'a@x.com' };
const budi = { display_name: null, email: 'budi@x.com' };

describe('splitParagraphs', () => {
  it('dipisah baris kosong, dirapikan', () => {
    expect(splitParagraphs('Satu.\n\n\nDua\nmasih dua.\n\n  ')).toEqual(['Satu.', 'Dua\nmasih dua.']);
  });
  it('daftar poin dipecah per poin', () => {
    expect(splitParagraphs('- a\n- b\n\nTeks')).toEqual(['- a', '- b', 'Teks']);
  });
  it('kosong → []', () => {
    expect(splitParagraphs('   ')).toEqual([]);
  });
});

describe('editedLabel', () => {
  it('belum diedit orang lain → hanya pembuat', () => {
    expect(editedLabel({ author: andi, editor: null, author_id: 'a', updated_by: null, updated_at: '2026-10-28T10:00:00Z' }, now)).toBe(
      'Ide asli: Andi',
    );
    expect(editedLabel({ author: andi, editor: andi, author_id: 'a', updated_by: 'a', updated_at: '2026-10-28T10:00:00Z' }, now)).toBe(
      'Ide asli: Andi',
    );
  });
  it('diedit anggota lain → nama + waktu', () => {
    expect(editedLabel({ author: andi, editor: budi, author_id: 'a', updated_by: 'b', updated_at: '2026-10-28T10:00:00Z' }, now)).toBe(
      'Ide asli: Andi · diedit budi@x.com 2 jam lalu',
    );
  });
});

describe('attributionLine', () => {
  it('pembuat dan versi terakhir', () => {
    expect(attributionLine({ author: andi, editor: budi })).toBe('Ide oleh Andi · versi terakhir budi@x.com');
    expect(attributionLine({ author: andi, editor: null })).toBe('Ide oleh Andi · versi terakhir Andi');
  });
});

describe('excerptChanged', () => {
  it('sumber lebih baru dari saat dikutip → berubah', () => {
    expect(excerptChanged('2026-10-28T10:00:00Z', '2026-10-28T11:00:00Z')).toBe(true);
    expect(excerptChanged('2026-10-28T10:00:00Z', '2026-10-28T10:00:00Z')).toBe(false);
  });
  it('format timestamp berbeda tapi waktu sama → tidak berubah', () => {
    expect(excerptChanged('2026-10-28T10:00:00+00:00', '2026-10-28T10:00:00.000Z')).toBe(false);
  });
  it('ide sumber terhapus/tidak terlihat → tidak berubah', () => {
    expect(excerptChanged('2026-10-28T10:00:00Z', null)).toBe(false);
  });
});
