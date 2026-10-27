import { Link, Tabs } from 'expo-router';
import { FileText, LayoutList, Mic, Settings, Users } from '../../src/ui/icons';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { TOUCH } from '../../src/theme/tokens';
import { ShieldStripe } from '../../src/ui/ShieldStripe';

export default function TabsLayout() {
  const { c, fonts } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: c.canvas },
        headerTintColor: c.inkStrong,
        headerTitleStyle: { fontFamily: fonts.sansSemibold, fontSize: 18 },
        headerShadowVisible: false,
        headerRight: () => (
          <Link href="/pengaturan" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pengaturan"
              style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
            >
              <Settings size={22} color={c.steel} strokeWidth={1.75} />
            </Pressable>
          </Link>
        ),
        tabBarActiveTintColor: c.link,
        tabBarInactiveTintColor: c.steel,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 12 },
        tabBarStyle: { backgroundColor: c.canvas, borderTopWidth: 0, height: 68, paddingTop: 8 },
        // Shield stripe di atas tab bar: penanda brand di setiap layar.
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: c.canvas }}>
            <ShieldStripe height={4} />
          </View>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Rekam', tabBarIcon: ({ color }) => <Mic size={24} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen
        name="catatan"
        options={{ title: 'Catatan Saya', tabBarLabel: 'Catatan', tabBarIcon: ({ color }) => <FileText size={24} color={color} strokeWidth={1.75} /> }}
      />
      <Tabs.Screen name="tim" options={{ title: 'Tim', tabBarIcon: ({ color }) => <Users size={24} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="prd" options={{ title: 'PRD', tabBarIcon: ({ color }) => <LayoutList size={24} color={color} strokeWidth={1.75} /> }} />
    </Tabs>
  );
}
