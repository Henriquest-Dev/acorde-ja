import { formatClock } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppText } from '@/components';
import { saveHelpOutcome } from '@/repositories/chat';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const TOTAL_MS = 2 * 60_000;
const INHALE = 4000;
const EXHALE = 6000;

/** Exercício de respiração guiado (2 minutos, 4 s inspirar / 6 s expirar). */
export default function Breathing() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const scale = useSharedValue(0.6);
  const elapsed = now - startedAt.current;
  const done = elapsed >= TOTAL_MS;
  const phase = elapsed % (INHALE + EXHALE) < INHALE ? 'in' : 'out';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (done || reduce) return;
    scale.value = withTiming(phase === 'in' ? 1 : 0.6, { duration: phase === 'in' ? INHALE : EXHALE, easing: Easing.inOut(Easing.sin) });
  }, [phase, done, reduce, scale]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const finish = async (outcome: 'helped' | 'partly' | 'not_helped') => {
    await saveHelpOutcome({ id: randomUUID(), difficulty: 'impulse', strategy: 'breathing', outcome, createdAt: Date.now() });
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12} style={{ alignSelf: 'flex-end' }}>
        <Feather name="x" size={24} color={colors.text} />
      </Pressable>
      <AppText variant="h2" align="center">
        Exercício de respiração
      </AppText>
      <View style={styles.center}>
        <View style={styles.stage}>
          <Animated.View style={[styles.circle, { borderColor: colors.text, backgroundColor: colors.card }, circle]} />
          <View style={[StyleSheet.absoluteFill, styles.stageText]}>
            <AppText variant="h2" accessibilityLiveRegion="polite">
              {done ? 'Muito bem' : phase === 'in' ? 'Inspire' : 'Expire'}
            </AppText>
            {!done ? (
              <AppText variant="small" tone="muted">
                {formatClock(TOTAL_MS - elapsed)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
      {done ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="body" tone="secondary" align="center">
            Ajudou?
          </AppText>
          <AppButton label="Sim, ajudou" onPress={() => void finish('helped')} />
          <AppButton label="Um pouco" variant="secondary" onPress={() => void finish('partly')} />
          <AppButton label="Não ajudou" variant="ghost" onPress={() => void finish('not_helped')} />
        </View>
      ) : (
        <AppText variant="small" tone="muted" align="center">
          Acompanhe o círculo. Inspire pelo nariz, expire devagar pela boca.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: 240, height: 240 },
  stageText: { alignItems: 'center', justifyContent: 'center' },
  circle: { width: 240, height: 240, borderRadius: 120, borderWidth: 2 },
});
