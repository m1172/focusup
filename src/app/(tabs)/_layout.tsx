import { PRO_ENABLED } from '../../config/release';
import { Tabs } from 'expo-router';
import { BottomNavigation, type TabKey } from '../../components/BottomNavigation';
import { useAppTheme } from '../../theme';

const routeToTab: Record<string, TabKey> = { index: 'home', statistics: 'stats', settings: 'settings', focus: 'home' };
const tabToRoute: Record<TabKey, string> = { home: 'index', stats: 'statistics', settings: 'settings' };

export default function TabLayout() {
  const c = useAppTheme();
  return <Tabs
    screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
    tabBar={({ state, navigateToTab }) => <BottomNavigation active={routeToTab[state.routes[state.index]?.name] ?? 'home'} onSelect={(key) => { const route = state.routes.find((item) => item.name === tabToRoute[key]); if (route) navigateToTab(route.key); }} />}
  >
    <Tabs.Screen name="index" />
    <Tabs.Screen name="statistics" />
    <Tabs.Screen name="settings" />
    <Tabs.Protected guard={PRO_ENABLED} redirectTo="/start"><Tabs.Screen name="focus" options={{ href: null }} /></Tabs.Protected>
  </Tabs>;
}
