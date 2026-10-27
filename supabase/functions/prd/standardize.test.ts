import { describe, expect, it } from 'vitest';
import { PRD_SECTIONS, buildStandardizeMessages, parseStandardized } from './standardize.ts';

const full = PRD_SECTIONS.map((s) => `## ${s}\nisi ${s}`).join('\n\n');

describe('buildStandardizeMessages', () => {
  it('memuat judul, isi PRD, dan kutipan beserta pembuatnya', () => {
    const [system, user] = buildStandardizeMessages({
      title: 'Widget',
      body_md: 'catatan bebas',
      excerpts: [{ quote_md: 'buat widget', author: 'Andi' }],
    });
    expect(system.role).toBe('system');
    for (const s of PRD_SECTIONS) expect(system.content).toContain(s);
    expect(user.content).toContain('Widget');
    expect(user.content).toContain('catatan bebas');
    expect(user.content).toContain('buat widget');
    expect(user.content).toContain('Andi');
  });
});

describe('parseStandardized', () => {
  it('menerima JSON dengan kelima bagian berurutan', () => {
    expect(parseStandardized(JSON.stringify({ markdown: full }))).toBe(full);
  });
  it('menolak bila ada bagian hilang', () => {
    const missing = full.replace('## Out of scope', '## Lainnya');
    expect(parseStandardized(JSON.stringify({ markdown: missing }))).toBeNull();
  });
  it('menolak bukan JSON / kosong', () => {
    expect(parseStandardized('maaf')).toBeNull();
    expect(parseStandardized(JSON.stringify({ markdown: '' }))).toBeNull();
    expect(parseStandardized(undefined)).toBeNull();
  });
});
