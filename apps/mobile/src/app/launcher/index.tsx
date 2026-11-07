import { formatClock, formatDuration, remainingMs } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProgressBar, AppText, Breathe, FadeInItem, PressableScale } from '@/components';
import { useLauncher } from '@/features/launcher/useLauncher';
import { useActiveChallenges } from '@/hooks/queries';
import { isDefaultHome, isLauncherPreview, openCamera, openDialer, openHomeSettings } from '@/services/launcher';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Launcher — ecrã inicial minimalista: só texto, sem ícones nem cor. */
export default function LauncherHome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const prefs = usePrefs((s) => s.prefs.launcher);
  const { favorites, open, inFocus, focusRemaining, usage, entries } = useLauncher();
  const challenges = useActiveChallenges();
  const [now, setNow] = useState(() => new Date());
  const isHome = useQuery({ queryKey: ['is-default-home'], queryFn: isDefaultHome, refetchInterval: 30_000 });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // O botão «voltar» não sai do ecrã inicial.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  const swipeUp = Gesture.Fling()
    .direction(1 << 2) // UP
    .runOnJS(true)
    .onEnd(() => router.push('/launcher/apps'));

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const used = usage?.measured ? usage.totals.usedMs : null;
  const limit = usage?.totals.limitMs ?? 0;
  const lostHome = !isLauncherPreview && prefs.enabled && prefs.lockDuringChallenge && (challenges.data?.length ?? 0) > 0 && isHome.data === false;
  const essential = new Set(favorites.filter((f) => !f.limit).map((f) => f.packageName));

  return (
    <GestureDetector gesture={swipeUp}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]} testID="launcher-home">
        {lostHome ? (
          <Pressable onPress={() => void openHomeSettings()} accessibilityRole="button" style={[styles.banner, { borderColor: colors.text }]}>
            <Feather name="alert-circle" size={16} color={colors.text} />
            <AppText variant="small" style={{ flex: 1 }}>
              O offly deixou de ser o ecrã inicial durante o desafio. Toque para voltar.
            </AppText>
          </Pressable>
        ) : null}

        {inFocus ? (
          <Animated.View entering={reduce ? undefined : FadeIn.duration(400)}>
            <AppText variant="overline" tone="muted">
              EM FOCO
            </AppText>
            <AppText style={[styles.clock, { color: colors.text }]} accessibilityLabel={`Foco: faltam ${formatClock(remainingMs(focusRemaining, now.getTime()))}`}>
              {formatClock(remainingMs(focusRemaining, now.getTime()))}
            </AppText>
            <AppProgressBar progress={1 - remainingMs(focusRemaining, now.getTime()) / focusRemaining.durationMs} height={3} style={{ marginTop: spacing.md }} />
          </Animated.View>
        ) : (
          <Animated.View entering={reduce ? undefined : FadeIn.duration(500)}>
            <AppText style={[styles.clock, { color: colors.text }]} accessibilityLabel={`São ${hh}:${mm}`}>
              {hh}:{mm}
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
              {WEEKDAYS[now.getDay()]}, {now.getDate()} de {MONTHS[now.getMonth()]}
            </AppText>
            {prefs.showUsage && used !== null ? (
              <View style={styles.meter}>
                <AppText variant="small" tone="secondary">
                  {formatDuration(used)} hoje
                </AppText>
                <AppProgressBar progress={limit > 0 ? used / limit : 0} height={3} style={{ flex: 1 }} />
                <AppText variant="small" tone="muted">
                  {formatDuration(Math.max(0, limit - used))}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
        )}

        <View style={styles.favs}>
          {favorites.map((f, i) => {
            const dim = f.locked || (inFocus && !essential.has(f.packageName));
            return (
              <FadeInItem key={f.packageName} index={i}>
                <PressableScale onPress={() => void open(f)} onLongPress={() => router.push('/settings/launcher')} accessibilityRole="button" accessibilityLabel={f.label} scaleTo={0.96} style={styles.fav}>
                  <AppText style={[styles.favText, { color: dim ? colors.textMuted : colors.text, opacity: dim ? 0.45 : 1 }]}>{f.label}</AppText>
                  {f.locked ? <Feather name="lock" size={16} color={colors.textMuted} style={{ marginLeft: 10 }} /> : null}
                </PressableScale>
              </FadeInItem>
            );
          })}
          {favorites.length === 0 && entries.length > 0 ? (
            <Pressable onPress={() => router.push('/settings/launcher')} accessibilityRole="button">
              <AppText variant="body" tone="muted">
                Escolha as apps do ecrã inicial
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push('/launcher/apps')} accessibilityRole="button" accessibilityLabel="Todas as apps" style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Breathe amount={0.12} period={2800}>
            <Feather name="chevron-up" size={20} color={colors.textMuted} />
          </Breathe>
          <AppText variant="overline" tone="muted" style={{ fontSize: 10 }}>
            DESLIZE PARA CIMA · TODAS AS APPS
          </AppText>
        </Pressable>
        <View style={styles.dock}>
          <PressableScale onPress={() => void openDialer()} accessibilityRole="button" accessibilityLabel="Telefone" style={styles.dockBtn}>
            <Feather name="phone" size={20} color={colors.text} />
          </PressableScale>
          <PressableScale
            onPress={() => router.push(inFocus ? '/focus' : { pathname: '/focus', params: { autostart: '1' } })}
            accessibilityRole="button"
            accessibilityLabel="Modo foco"
            style={[styles.focusChip, { borderColor: colors.borderStrong }]}
          >
            <Feather name="target" size={14} color={colors.text} />
            <AppText variant="small">{inFocus ? 'Em foco' : 'Foco'}</AppText>
          </PressableScale>
          <PressableScale onPress={() => void openCamera()} accessibilityRole="button" accessibilityLabel="Câmara" style={styles.dockBtn}>
            <Feather name="camera" size={20} color={colors.text} />
          </PressableScale>
        </View>
        <Pressable onPress={() => router.push('/')} accessibilityRole="button" accessibilityLabel="Abrir o offly" style={{ position: 'absolute', top: insets.top + spacing.md, right: spacing.xl, padding: 6 }}>
          <AppText variant="small" weight="semibold" style={{ letterSpacing: -0.3 }}>
            offly
          </AppText>
        </Pressable>
        {isLauncherPreview ? (
          <AppText variant="caption" tone="muted" align="center" style={{ fontSize: 10 }}>
            Pré-visualização web · no Android aparecem as apps instaladas
          </AppText>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28 },
  clock: { fontFamily: fonts.light, fontSize: 84, lineHeight: 92, letterSpacing: -4 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  favs: { marginTop: 48, gap: 4 },
  fav: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, alignSelf: 'flex-start' },
  favText: { fontFamily: fonts.regular, fontSize: 30, letterSpacing: -0.6 },
  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  dockBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  focusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
});
