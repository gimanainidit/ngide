import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { authorName, type Idea } from './api';
import { snippet, timeAgo } from './format';

type Props = {
  load: () => Promise<Idea[]>;
  empty: string;
  header?: ReactNode;
  showAuthor?: boolean;
};

export function IdeaList({ load, empty, header, showAuthor }: Props) {
  const [items, setItems] = useState<Idea[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={<>{header}{error && <Text style={s.error}>{error}</Text>}</>}
      ListEmptyComponent={refreshing ? undefined : <Text style={s.empty}>{empty}</Text>}
      contentContainerStyle={s.content}
      renderItem={({ item }) => (
        <Pressable style={s.card} onPress={() => router.push(`/ide/${item.id}`)}>
          <View style={s.row}>
            <Text style={s.title} numberOfLines={1}>{item.title}</Text>
            {item.status === 'draft' && <Text style={s.badge}>Draft</Text>}
          </View>
          <Text style={s.snippet} numberOfLines={3}>{snippet(item.body_md, 200)}</Text>
          <Text style={s.meta}>
            {showAuthor ? `${authorName(item)} · ` : ''}
            {timeAgo(item.shared_at ?? item.created_at)}
            {item.original_md !== null && item.updated_by && item.updated_by !== item.author_id ? ' · diedit tim' : ''}
          </Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  badge: { fontSize: 12, backgroundColor: '#fde68a', color: '#78350f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  snippet: { fontSize: 14, opacity: 0.85 },
  meta: { fontSize: 12, opacity: 0.6 },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 48 },
  error: { color: '#c00', textAlign: 'center', marginBottom: 8 },
});
