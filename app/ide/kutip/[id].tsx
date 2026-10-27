import { router, useLocalSearchParams } from 'expo-router';
import { Circle, CircleDot, Quote, Square, SquareCheck } from '../../../src/ui/icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { addExcerpts, createPrd, getIdea, listPrds, type Idea, type Prd } from '../../../src/lib/api';
import { splitParagraphs } from '../../../src/lib/attribution';
import { makeStyles, useTheme } from '../../../src/theme/ThemeContext';
import { Button } from '../../../src/ui/Button';
import { Field } from '../../../src/ui/Field';
import { CenterState, ErrorText, Screen } from '../../../src/ui/Screen';
import { T } from '../../../src/ui/Text';

// Pilih paragraf dari ide yang dibagikan, lalu tempel ke PRD sebagai kutipan (snapshot).
export default function Kutip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { c } = useTheme();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [prds, setPrds] = useState<Prd[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getIdea(id), listPrds()])
      .then(([i, p]) => {
        setIdea(i);
        setPrds(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat'));
  }, [id]);

  if (!idea) return <CenterState error={error} />;
  if (idea.status !== 'shared') return <CenterState error="Bagikan ide ke tim dulu sebelum mengutipnya ke PRD." />;

  const paragraphs = splitParagraphs(idea.body_md);
  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const canSave = picked.size > 0 && (target !== null || newTitle.trim().length > 0) && !busy;

  async function save() {
    if (!idea) return;
    setBusy(true);
    setError(null);
    try {
      const prdId = target ?? (await createPrd(newTitle));
      const quotes = [...picked].sort((a, b) => a - b).map((i) => paragraphs[i]);
      await addExcerpts(prdId, idea, quotes);
      router.replace(`/prd/${prdId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan kutipan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <T variant="eyebrow">1. Pilih paragraf dari “{idea.title}”</T>
      {paragraphs.map((p, i) => {
        const on = picked.has(i);
        const Icon = on ? SquareCheck : Square;
        return (
          <Pressable
            key={i}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => toggle(i)}
            style={({ pressed }) => [s.item, on && s.itemOn, pressed && { opacity: 0.85 }]}
          >
            <Icon size={22} color={on ? c.link : c.steel} strokeWidth={2} />
            <T variant="small" style={{ flex: 1 }}>{p}</T>
          </Pressable>
        );
      })}

      <T variant="eyebrow" style={{ marginTop: 8 }}>2. Masukkan ke PRD</T>
      {prds.map((p) => {
        const on = target === p.id;
        const Icon = on ? CircleDot : Circle;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => setTarget(p.id)}
            style={({ pressed }) => [s.item, on && s.itemOn, pressed && { opacity: 0.85 }]}
          >
            <Icon size={22} color={on ? c.primary : c.steel} strokeWidth={2} />
            <T variant="heading" style={{ flex: 1 }}>{p.title}</T>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: target === null }}
        onPress={() => setTarget(null)}
        style={[s.item, target === null && s.itemOn, { flexDirection: 'column', alignItems: 'stretch' }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {target === null ? <CircleDot size={22} color={c.primary} strokeWidth={2} /> : <Circle size={22} color={c.steel} strokeWidth={2} />}
          <T variant="heading">PRD baru</T>
        </View>
        {target === null && <Field value={newTitle} onChangeText={setNewTitle} placeholder="Nama produk / judul PRD" />}
      </Pressable>

      {error && <ErrorText>{error}</ErrorText>}
      <Button
        label={picked.size ? `Kutip ${picked.size} paragraf` : 'Pilih paragraf dulu'}
        variant="primary"
        icon={Quote}
        onPress={save}
        disabled={!canSave}
        busy={busy}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ c, radius, space }) => ({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    padding: space.sm,
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: radius.xl,
    backgroundColor: c.canvas,
  },
  itemOn: { borderColor: c.link, borderWidth: 2, backgroundColor: c.accentSoft },
}));
