import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

// Entrar é sempre o primeiro ecrã do grupo de autenticação.
export const unstable_settings = { initialRouteName: 'sign-in' };

export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
