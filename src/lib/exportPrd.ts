import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Excerpt, Prd } from './api';
import { attributionLine, excerptChanged } from './attribution';
import { buildPrdMarkdown, prdFileName } from './prdExport';

// Tulis PRD ke file .md di cache lalu buka share sheet Android.
export async function sharePrdMarkdown(prd: Pick<Prd, 'title' | 'body_md'>, excerpts: Excerpt[]) {
  const md = buildPrdMarkdown(
    prd,
    excerpts.map((e) => ({
      quote_md: e.quote_md,
      ideaTitle: e.idea?.title ?? 'Ide terhapus',
      attribution: e.idea ? attributionLine(e.idea) : 'Ide sumber sudah tidak tersedia',
      changed: excerptChanged(e.idea_updated_at, e.idea?.updated_at ?? null),
    })),
    new Date(),
  );
  const file = new File(Paths.cache, prdFileName(prd.title));
  if (file.exists) file.delete();
  await file.write(md);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Berbagi file tidak didukung di HP ini');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: `Export ${prd.title}` });
}
