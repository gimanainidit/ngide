import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getIdea, listRevisions, type Idea, type Revision } from '../../../src/lib/api';
import { personName } from '../../../src/lib/attribution';
import { timeAgo } from '../../../src/lib/format';
import { useTheme } from '../../../src/theme/ThemeContext';
import { Badge } from '../../../src/ui/Badge';
import { Card } from '../../../src/ui/Card';
import { CenterState, Screen } from '../../../src/ui/Screen';
import { T } from '../../../src/ui/Text';

// Hanya baca: versi asli pemilik + setiap revisi setelah dibagikan.
export default function Riwayat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getIdea(id), listRevisions(id)])
      .then(([i, r]) => {
        setIdea(i);
        setRevisions(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat riwayat'));
  }, [id]);

  if (!idea || !revisions) return <CenterState error={error} />;

  return (
    <Screen>
      {revisions.length === 0 && <T variant="small" style={{ color: c.steel }}>Belum ada yang mengedit ide ini sejak dibagikan.</T>}
      {revisions.map((r, index) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {index === 0 && <Badge kind="shared" label="Terbaru" />}
            <T variant="caption">
              {personName(r.editor)} · {timeAgo(r.created_at)}
            </T>
          </View>
          <T variant="heading">{r.title}</T>
          <T variant="small" selectable>{r.body_md}</T>
        </Card>
      ))}
      <Card style={{ borderColor: c.primary, borderWidth: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Badge kind="draft" label="Versi asli" />
          <T variant="caption">
            {personName(idea.author)}
            {idea.shared_at ? ` · dibagikan ${timeAgo(idea.shared_at)}` : ''}
          </T>
        </View>
        <T variant="heading">{idea.original_title ?? idea.title}</T>
        <T variant="small" selectable>{idea.original_md ?? idea.body_md}</T>
      </Card>
    </Screen>
  );
}
