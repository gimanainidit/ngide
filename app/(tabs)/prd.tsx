import { router, useFocusEffect } from 'expo-router';
import { Plus } from '../../src/ui/icons';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { createPrd, listPrds, type Prd } from '../../src/lib/api';
import { personName } from '../../src/lib/attribution';
import { snippet, timeAgo } from '../../src/lib/format';
import { makeStyles, useTheme } from '../../src/theme/ThemeContext';
import { Button } from '../../src/ui/Button';
import { PressableCard } from '../../src/ui/Card';
import { Field } from '../../src/ui/Field';
import { ErrorText } from '../../src/ui/Screen';
import { T } from '../../src/ui/Text';

export default function PrdList() {
  const s = useStyles();
  const { c } = useTheme();
  const [items, setItems] = useState<Prd[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await listPrds());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat');
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function create() {
    if (!title.trim()) return;
    try {
      const id = await createPrd(title);
      setTitle('');
      router.push(`/prd/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat PRD');
    }
  }

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={items}
      keyExtractor={(p) => p.id}
      refreshing={refreshing}
      onRefresh={refresh}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={s.create}>
          <View style={{ flex: 1 }}>
            <Field value={title} onChangeText={setTitle} placeholder="Nama produk untuk PRD baru" onSubmitEditing={create} returnKeyType="done" />
          </View>
          <Button label="Buat" variant="primary" icon={Plus} onPress={create} disabled={!title.trim()} />
          {error && <ErrorText>{error}</ErrorText>}
        </View>
      }
      ListEmptyComponent={
        loaded && !refreshing ? (
          <T variant="body" style={s.empty}>
            Belum ada PRD. Ketik nama produk di atas, atau buka ide yang dibagikan lalu pilih “Kutip ke PRD”.
          </T>
        ) : undefined
      }
      renderItem={({ item }) => (
        <PressableCard onPress={() => router.push(`/prd/${item.id}`)} accessibilityLabel={`Buka PRD ${item.title}`}>
          <T variant="heading">{item.title}</T>
          {!!item.body_md.trim() && (
            <T variant="small" numberOfLines={2}>
              {snippet(item.body_md.replace(/#+\s/g, ''), 160)}
            </T>
          )}
          <T variant="caption">
            Diubah {timeAgo(item.updated_at)}
            {item.editor ? ` oleh ${personName(item.editor)}` : ''}
          </T>
        </PressableCard>
      )}
    />
  );
}

const useStyles = makeStyles(({ c, space }) => ({
  content: { padding: space.md, gap: space.sm, flexGrow: 1 },
  create: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'flex-start', marginBottom: 4 },
  empty: { textAlign: 'center', color: c.steel, marginTop: 48, paddingHorizontal: space.md },
}));
