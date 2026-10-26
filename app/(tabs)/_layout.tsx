import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: 'center' }}>
      <Tabs.Screen name="index" options={{ title: 'Rekam' }} />
      <Tabs.Screen name="catatan" options={{ title: 'Catatan Saya' }} />
      <Tabs.Screen name="tim" options={{ title: 'Tim' }} />
    </Tabs>
  );
}
