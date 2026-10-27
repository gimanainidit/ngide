import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { fonts, palettes, radius, space, type Palette, type Scheme } from './tokens';

type Theme = { scheme: Scheme; c: Palette; fonts: typeof fonts; radius: typeof radius; space: typeof space };

const ThemeContext = createContext<Theme | null>(null);

// Mengikuti setelan terang/gelap HP.
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const value = useMemo(() => ({ scheme, c: palettes[scheme], fonts, radius, space }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme dipakai di luar AppThemeProvider');
  return theme;
}

// Gaya yang dihitung ulang hanya saat tema berganti.
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles<T>>(factory: (t: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)) as T, [theme]);
  };
}
