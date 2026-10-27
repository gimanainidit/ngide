import { Text, View } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';

export type BadgeKind = 'draft' | 'shared' | 'local' | 'changed' | 'neutral';

const useStyles = makeStyles(({ c, fonts, radius }) => ({
  base: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  label: { fontFamily: fonts.sansSemibold, fontSize: 12, lineHeight: 16 },
  draft: { backgroundColor: c.accentSoft },
  draftText: { color: c.inkStrong },
  shared: { backgroundColor: c.primary },
  sharedText: { color: c.onPrimary },
  local: { backgroundColor: c.navy950 },
  localText: { color: c.onDark },
  changed: { borderWidth: 1, borderColor: c.link, paddingVertical: 2 },
  changedText: { color: c.link },
  neutral: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.hairline },
  neutralText: { color: c.ink },
}));

// Makna badge tidak hanya dari warna: selalu ada label teks.
export function Badge({ kind, label }: { kind: BadgeKind; label: string }) {
  const s = useStyles();
  return (
    <View style={[s.base, s[kind]]}>
      <Text style={[s.label, s[`${kind}Text`]]}>{label}</Text>
    </View>
  );
}
