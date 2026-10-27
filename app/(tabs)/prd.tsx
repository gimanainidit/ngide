import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createPrd, listPrds, type Prd } from '../../src/lib/api';
import { personName } from '../../src/lib/attribution';
import { snippet, timeAgo } from '../../src/lib/format';

export default function PrdList() {
  const [items, setItems] = useState<Prd[]>([]);
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
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function create() {
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
      data={items}
      keyExtractor={(p) => p.id}
      refreshing={refreshing}
      onRefresh={refresh}
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <View style={s.create}>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Nama produk untuk PRD baru" onSubmitEditing={create} />
          <Pressable style={[s.btn, !title.trim() && { opacity: 0.4 }]} onPress={create} disabled={!title.trim()}>
            <Text style={s.btnText}>Buat</Text>
          </Pressable>
          {error && <Text style={s.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        refreshing ? undefined : (
          <Text style={s.empty}>Belum ada PRD. Buat dari sini, atau buka ide yang dibagikan lalu pilih “Kutip ke PRD”.</Text>
        )
      }
      renderItem={({ item }) => (
        <Pressable style={s.card} onPress={() => router.push(`/prd/${item.id}`)}>
          <Text style={s.title}>{item.title}</Text>
          {!!item.body_md.trim() && (
            <Text style={s.snippet} numberOfLines={2}>
              {snippet(item.body_md.replace(/#+\s/g, ''), 160)}
            </Text>
          )}
          <Text style={s.meta}>
            Diubah {timeAgo(item.updated_at)}
            {item.editor ? ` oleh ${personName(item.editor)}` : ''}
          </Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  create: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 4 },
  input: { flex: 1, minWidth: 180, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  btn: { backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 12, padding: 14, gap: 6 },
  title: { fontSize: 16, fontWeight: '700' },
  snippet: { fontSize: 14, opacity: 0.85 },
  meta: { fontSize: 12, opacity: 0.6 },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 40, paddingHorizontal: 16 },
  error: { color: '#c00', width: '100%' },
});
