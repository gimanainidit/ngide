import { Link, Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        headerRight: () => (
          <Link href="/pengaturan" style={{ paddingHorizontal: 16 }}>
            <Text>Pengaturan</Text>
          </Link>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Rekam' }} />
      <Tabs.Screen name="catatan" options={{ title: 'Catatan Saya' }} />
      <Tabs.Screen name="tim" options={{ title: 'Tim' }} />
    </Tabs>
  );
}
