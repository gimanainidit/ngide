import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { PressableCard } from '../ui/Card';
import { ErrorText } from '../ui/Screen';
import { T } from '../ui/Text';
import { authorName, type Idea } from './api';
import { snippet, timeAgo } from './format';

type Props = {
  load: () => Promise<Idea[]>;
  empty: string;
  emptyAction?: { label: string; onPress: () => void };
  header?: ReactNode;
  showAuthor?: boolean;
};

export function IdeaList({ load, empty, emptyAction, header, showAuthor }: Props) {
  const s = useStyles();
  const { c } = useTheme();
  const [items, setItems] = useState<Idea[]>([]);
  const [loaded, setLoaded] = useState(false);
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
      setLoaded(true);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={items}
      keyExtractor={(i) => i.id}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={
        <>
          {header}
          {error && <ErrorText>{error}</ErrorText>}
        </>
      }
      ListEmptyComponent={
        loaded && !refreshing ? (
          <View style={s.empty}>
            <T variant="body" style={{ textAlign: 'center', color: c.steel }}>{empty}</T>
            {emptyAction && <Button label={emptyAction.label} variant="primary" onPress={emptyAction.onPress} />}
          </View>
        ) : undefined
      }
      contentContainerStyle={s.content}
      renderItem={({ item }) => {
        const editedByTeam = item.status !== 'draft' && !!item.updated_by && item.updated_by !== item.author_id;
        return (
          <PressableCard onPress={() => router.push(`/ide/${item.id}`)} accessibilityLabel={`Buka ide ${item.title}`}>
            <View style={s.row}>
              <T variant="heading" numberOfLines={1} style={{ flex: 1 }}>{item.title}</T>
              {item.status === 'draft' ? <Badge kind="draft" label="Draft" /> : <Badge kind="shared" label="Dibagikan" />}
            </View>
            <T variant="small" numberOfLines={3}>{snippet(item.body_md, 200)}</T>
            <T variant="caption">
              {showAuthor ? `${authorName(item)} · ` : ''}
              {timeAgo(item.shared_at ?? item.created_at)}
              {editedByTeam ? ' · diedit tim' : ''}
            </T>
          </PressableCard>
        );
      }}
    />
  );
}

const useStyles = makeStyles(({ space }) => ({
  content: { padding: space.md, gap: space.sm, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  empty: { marginTop: 64, gap: space.md, alignItems: 'center', paddingHorizontal: space.md },
}));
