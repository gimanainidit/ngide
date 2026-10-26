import { describe, expect, it } from 'vitest';
import { buildIdea, formatTitle, paragraphize } from './markdown.ts';

describe('formatTitle', () => {
  it('memakai zona waktu Jakarta', () => {
    // 2026-10-26 15:41 UTC = 22:41 WIB
    expect(formatTitle(new Date('2026-10-26T15:41:00Z'))).toBe('Ide 26 Okt 22.41');
  });
});

describe('paragraphize', () => {
  it('menggabungkan spasi dan newline berlebih', () => {
    expect(paragraphize('  halo   dunia \n ini  tes ')).toBe('halo dunia ini tes');
  });

  it('memecah per 3 kalimat menjadi paragraf', () => {
    const text = 'Satu. Dua! Tiga? Empat. Lima.';
    expect(paragraphize(text)).toBe('Satu. Dua! Tiga?\n\nEmpat. Lima.');
  });

  it('transkrip tanpa tanda baca tetap satu paragraf', () => {
    expect(paragraphize('ide aplikasi catatan suara')).toBe('ide aplikasi catatan suara');
  });

  it('kosong tetap kosong', () => {
    expect(paragraphize('   \n ')).toBe('');
  });
});

describe('buildIdea', () => {
  it('menghasilkan judul dan body dari transkrip', () => {
    const idea = buildIdea('Kita bisa buat widget. Biar cepat rekam.', new Date('2026-10-26T15:41:00Z'));
    expect(idea).toEqual({
      title: 'Ide 26 Okt 22.41',
      body_md: 'Kita bisa buat widget. Biar cepat rekam.',
    });
  });

  it('mengembalikan null jika tidak ada suara', () => {
    expect(buildIdea('  ', new Date())).toBeNull();
  });
});

describe('parsePolished', () => {
  it('menerima JSON valid', async () => {
    const { parsePolished } = await import('./markdown.ts');
    expect(parsePolished('{"title":" Widget ","body_md":"- satu\\n- dua"}')).toEqual({ title: 'Widget', body_md: '- satu\n- dua' });
  });
  it('menolak bentuk salah', async () => {
    const { parsePolished } = await import('./markdown.ts');
    expect(parsePolished('bukan json')).toBeNull();
    expect(parsePolished('{"title":"x"}')).toBeNull();
    expect(parsePolished('{"title":"","body_md":"x"}')).toBeNull();
    expect(parsePolished(undefined)).toBeNull();
  });
});
