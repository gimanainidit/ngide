const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type ExportExcerpt = { quote_md: string; ideaTitle: string; attribution: string; changed: boolean };

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return `${get('day')} ${BULAN[get('month') - 1]} ${get('year')}`;
}

export function prdFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'prd'}.md`;
}

export function buildPrdMarkdown(prd: { title: string; body_md: string }, excerpts: ExportExcerpt[], at: Date): string {
  const parts = [`# ${prd.title.trim()}`];
  const body = prd.body_md.trim();
  if (body) parts.push(body);
  if (excerpts.length > 0) {
    parts.push('---', '## Ide terkait');
    for (const e of excerpts) {
      const quote = e.quote_md.trim().split('\n').map((l) => `> ${l}`).join('\n');
      const note = e.changed ? ' · (sumber sudah diedit setelah dikutip)' : '';
      parts.push(quote, `— *${e.ideaTitle}* · ${e.attribution}${note}`);
    }
  }
  return `${parts.join('\n\n')}\n\n---\nDiekspor dari Ngide · ${formatDate(at)}\n`;
}
