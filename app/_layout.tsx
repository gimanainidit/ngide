// Impor per-ketebalan: impor dari indeks paket akan membundel semua varian font.
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { useSyncRunner } from '../src/lib/syncRunner';
import { useSession } from '../src/lib/useSession';
import { AppThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { CenterState } from '../src/ui/Screen';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <Root />
    </AppThemeProvider>
  );
}

function Root() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const { scheme, c, fonts } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
  });
  useSyncRunner(!!session);

  const ready = (fontsLoaded || !!fontError) && !loading;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.background);
  }, [c.background]);

  // Header, tab bar, dan latar navigasi memakai token tema.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.link, background: c.background, card: c.canvas, text: c.inkStrong, border: c.hairline, notification: c.destructive },
    };
  }, [scheme, c]);

  if (!ready) return <CenterState />;
  const inAuth = segments[0] === 'login' || segments[0] === 'auth-callback';
  if (!session && !inAuth) return <Redirect href="/login" />;
  if (session && inAuth) return <Redirect href="/" />;

  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: c.canvas },
    headerTintColor: c.inkStrong,
    headerTitleStyle: { fontFamily: fonts.sansSemibold, fontSize: 18 },
    headerShadowVisible: false,
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="ide/[id]" options={{ ...header, title: 'Ide' }} />
        <Stack.Screen name="draf/[id]" options={{ ...header, title: 'Draft lokal' }} />
        <Stack.Screen name="pengaturan" options={{ ...header, title: 'Pengaturan' }} />
        <Stack.Screen name="ide/riwayat/[id]" options={{ ...header, title: 'Riwayat' }} />
        <Stack.Screen name="ide/kutip/[id]" options={{ ...header, title: 'Kutip ke PRD' }} />
        <Stack.Screen name="prd/[id]" options={{ ...header, title: 'PRD' }} />
      </Stack>
    </ThemeProvider>
  );
}
