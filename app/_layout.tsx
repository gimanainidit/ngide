import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../src/lib/useSession';

export default function RootLayout() {
  const { session, loading } = useSession();
  const segments = useSegments();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const inAuth = segments[0] === 'login';
  if (!session && !inAuth) return <Redirect href="/login" />;
  if (session && inAuth) return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ide/[id]" options={{ headerShown: true, title: 'Ide' }} />
    </Stack>
  );
}
