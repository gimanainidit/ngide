import { describe, expect, it } from 'vitest';
import { buildPrdMarkdown, prdFileName } from './prdExport';

describe('prdFileName', () => {
  it('slug aman untuk nama file', () => {
    expect(prdFileName('PRD: Widget Rekam Cepat!')).toBe('prd-widget-rekam-cepat.md');
    expect(prdFileName('Ide Ngide — v2 (beta)')).toBe('ide-ngide-v2-beta.md');
    expect(prdFileName('???')).toBe('prd.md');
  });
});

describe('buildPrdMarkdown', () => {
  it('judul, isi, lalu ide terkait dengan atribusi di paling bawah', () => {
    const md = buildPrdMarkdown(
      { title: 'Widget Rekam', body_md: '## Latar masalah\nIde hilang.\n' },
      [
        { quote_md: 'Buat widget.', ideaTitle: 'Ide widget', attribution: 'Ide oleh Andi · versi terakhir Budi', changed: true },
        { quote_md: '- poin a\n- poin b', ideaTitle: 'Ide lain', attribution: 'Ide oleh Budi · versi terakhir Budi', changed: false },
      ],
      new Date('2026-10-28T05:00:00Z'),
    );
    expect(md).toBe(`# Widget Rekam

## Latar masalah
Ide hilang.

---

## Ide terkait

> Buat widget.

— *Ide widget* · Ide oleh Andi · versi terakhir Budi · (sumber sudah diedit setelah dikutip)

> - poin a
> - poin b

— *Ide lain* · Ide oleh Budi · versi terakhir Budi

---
Diekspor dari Ngide · 28 Okt 2026
`);
  });

  it('tanpa kutipan → tanpa bagian Ide terkait', () => {
    expect(buildPrdMarkdown({ title: 'X', body_md: '' }, [], new Date('2026-10-28T05:00:00Z'))).toBe(
      '# X\n\n---\nDiekspor dari Ngide · 28 Okt 2026\n',
    );
  });
});
