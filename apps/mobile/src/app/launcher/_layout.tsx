import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

export default function LauncherLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="apps" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="pause" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
