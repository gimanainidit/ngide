import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSyncRunner } from '../src/lib/syncRunner';
import { useSession } from '../src/lib/useSession';

export default function RootLayout() {
  const { session, loading } = useSession();
  const segments = useSegments();
  useSyncRunner(!!session);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const inAuth = segments[0] === 'login' || segments[0] === 'auth-callback';
  if (!session && !inAuth) return <Redirect href="/login" />;
  if (session && inAuth) return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ide/[id]" options={{ headerShown: true, title: 'Ide' }} />
      <Stack.Screen name="draf/[id]" options={{ headerShown: true, title: 'Draft lokal' }} />
      <Stack.Screen name="pengaturan" options={{ headerShown: true, title: 'Pengaturan' }} />
      <Stack.Screen name="ide/riwayat/[id]" options={{ headerShown: true, title: 'Riwayat' }} />
      <Stack.Screen name="ide/kutip/[id]" options={{ headerShown: true, title: 'Kutip ke PRD' }} />
      <Stack.Screen name="prd/[id]" options={{ headerShown: true, title: 'PRD' }} />
    </Stack>
  );
}
