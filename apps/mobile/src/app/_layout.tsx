import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppButton, AppErrorState, AppLogo, AppText, AppToastHost } from '@/components';
import { getDb } from '@/database/db';
import { ensureDefaultLimits, ensureDefaultSchedule } from '@/repositories/limits';
import { configureNotifications } from '@/services/notifications';
import { flushSync } from '@/services/sync';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from '@/stores/prefs';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

/** Arranque: base de dados, preferências, valores por defeito e regras nativas. */
async function bootSequence(loadPrefs: () => Promise<void>) {
  await getDb();
  await loadPrefs();
  await ensureDefaultLimits();
  await ensureDefaultSchedule();
  configureNotifications();
  await syncRulesToNative().catch(() => undefined);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [bootError, setBootError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { prefs, loaded, load } = usePrefs();

  const boot = useCallback(() => {
    // Estado só é actualizado depois das operações assíncronas (callbacks .then).
    void bootSequence(load).then(
      () => setReady(true),
      (e: unknown) => setBootError(e instanceof Error ? e.message : String(e)),
    );
  }, [load]);

  useEffect(() => {
    boot();
  }, [boot]);

  const retryBoot = useCallback(() => {
    setBootError(null);
    boot();
  }, [boot]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && (ready || bootError)) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError, ready, bootError]);

  // Ao regressar ao primeiro plano: reaplica regras e sincroniza a fila.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void syncRulesToNative().catch(() => undefined);
      void flushSync().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['today'] });
    });
    return () => sub.remove();
  }, []);

  // Sincronização após reconexão à Internet.
  useEffect(() => {
    const sub = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) void flushSync().catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  // Abrir o aplicativo a partir de uma notificação com deep link.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('acordeja://')) router.push(url.replace('acordeja://', '/') as never);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <ThemeProvider preference={prefs.theme}>
          <QueryClientProvider client={queryClient}>
            <Shell bootError={bootError} onRetry={retryBoot} ready={ready && loaded} onboardingDone={prefs.onboardingDone} biometricLock={prefs.biometricLock} />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell({
  bootError,
  onRetry,
  ready,
  onboardingDone,
  biometricLock,
}: {
  bootError: string | null;
  onRetry: () => void;
  ready: boolean;
  onboardingDone: boolean;
  biometricLock: boolean;
}) {
  const { colors, scheme } = useTheme();
  const segments = useSegments();
  const navState = useRootNavigationState();

  // Sem onboarding concluído, qualquer rota (excepto o retorno de autenticação) leva ao onboarding.
  useEffect(() => {
    if (!ready || !navState?.key) return;
    const first = segments[0] as string | undefined;
    if (!onboardingDone && first !== 'onboarding' && !(first === 'auth' && segments[1] === 'callback')) router.replace('/onboarding');
  }, [ready, navState?.key, onboardingDone, segments]);

  if (bootError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <AppErrorState message={`Não foi possível abrir a base de dados local. ${bootError}`} onRetry={onRetry} />
      </View>
    );
  }
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="block" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="limit-warning" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="help-now" options={{ presentation: 'modal' }} />
          <Stack.Screen name="breathing" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
        <Stack.Screen name="auth" />
      </Stack>
      {biometricLock && Platform.OS !== 'web' ? <BiometricGate /> : null}
      <AppToastHost />
    </View>
  );
}

/** Bloqueio biométrico local opcional (Face ID / impressão digital). */
function BiometricGate() {
  const { colors } = useTheme();
  const [locked, setLocked] = useState(true);
  const lastActive = useRef(0);

  const unlock = useCallback(() => {
    void LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear o Acorde Já', cancelLabel: 'Cancelar' }).then((res) => {
      if (res.success) setLocked(false);
    });
  }, []);

  useEffect(() => {
    unlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') lastActive.current = Date.now();
      if (s === 'active' && Date.now() - lastActive.current > 60_000) {
        setLocked(true);
        unlock();
      }
    });
    return () => sub.remove();
  }, [unlock]);

  if (!locked) return null;
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      <AppLogo size={72} />
      <AppText variant="h2">Acorde Já</AppText>
      <AppButton label="Desbloquear" onPress={unlock} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
