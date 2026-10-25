import { Tabs } from 'expo-router/js-tabs';
import { AppTabBar } from '@/components';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="protection" options={{ title: 'Proteção' }} />
      <Tabs.Screen name="focus" options={{ title: 'Foco' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progresso' }} />
      <Tabs.Screen name="assistant" options={{ title: 'IA' }} />
    </Tabs>
  );
}
