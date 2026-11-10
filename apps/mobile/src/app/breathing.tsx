import { formatClock } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { goBack } from '@/navigation/goBack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppText, LeafBackdrop, Offy } from '@/components';
import { AMBIENT_LABEL, playAmbient, stopAmbient, type AmbientSound } from '@/services/ambient';
import { usePrefs } from '@/stores/prefs';
import { saveHelpOutcome } from '@/repositories/chat';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const SOUNDS: AmbientSound[] = ['none', 'rain', 'waves', 'forest'];

const TOTAL_MS = 2 * 60_000;
const INHALE = 4000;
const EXHALE = 6000;

/** Exercício de respiração guiado (2 minutos, 4 s inspirar / 6 s expirar). */
export default function Breathing() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const { prefs, update } = usePrefs();
  const scale = useSharedValue(0.6);
  const ring = useSharedValue(0);
  const elapsed = now - startedAt;
  const done = elapsed >= TOTAL_MS;
  const phase = elapsed % (INHALE + EXHALE) < INHALE ? 'in' : 'out';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (done || reduce) return;
    scale.value = withTiming(phase === 'in' ? 1 : 0.6, { duration: phase === 'in' ? INHALE : EXHALE, easing: Easing.inOut(Easing.sin) });
    // Uma onda ténue sai do círculo no início de cada expiração.
    if (phase === 'out') {
      ring.value = 0;
      ring.value = withTiming(1, { duration: EXHALE, easing: Easing.out(Easing.quad) });
    }
  }, [phase, done, reduce, scale, ring]);

  // Som de fundo: começa ao abrir, pára ao sair ou ao terminar.
  useEffect(() => {
    void playAmbient(done ? 'none' : prefs.calmSound);
  }, [prefs.calmSound, done]);
  useEffect(() => () => stopAmbient(true), []);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const wave = useAnimatedStyle(() => ({ opacity: (1 - ring.value) * 0.35, transform: [{ scale: 0.6 + ring.value * 0.55 }] }));

  const finish = async (outcome: 'helped' | 'partly' | 'not_helped') => {
    await saveHelpOutcome({ id: randomUUID(), difficulty: 'impulse', strategy: 'breathing', outcome });
    goBack();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => void update({ calmSound: prefs.calmSound === 'none' ? 'rain' : 'none' })}
          accessibilityRole="button"
          accessibilityLabel={prefs.calmSound === 'none' ? 'Ligar o som' : 'Desligar o som'}
          hitSlop={12}
          style={[styles.soundBtn, { borderColor: colors.border }]}
          testID="calm-mute"
        >
          <Feather name={prefs.calmSound === 'none' ? 'volume-x' : 'volume-2'} size={18} color={colors.text} />
          <AppText variant="caption">{prefs.calmSound === 'none' ? 'Som desligado' : 'Desligar som'}</AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            stopAmbient(true);
            goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hitSlop={12}
        >
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
      </View>
      <LeafBackdrop opacity={0.06} />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Offy size={84} mood={done ? 'idle' : 'calm'} testID="offy-calm" />
        <AppText variant="h2" align="center">
          {done ? 'Estás mais calmo' : 'Respira comigo'}
        </AppText>
      </View>
      <View style={styles.center}>
        <View style={styles.stage}>
          <Animated.View style={[styles.circle, { borderColor: colors.text, position: 'absolute' }, wave]} />
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
        <View style={{ gap: spacing.lg }}>
          <AppText variant="small" tone="muted" align="center">
            Acompanhe o círculo. Inspire pelo nariz, expire devagar pela boca.
          </AppText>
          <View style={styles.sounds} accessibilityRole="radiogroup" accessibilityLabel="Som de fundo">
            {SOUNDS.map((s) => {
              const on = prefs.calmSound === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => void update({ calmSound: s })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.sound, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : 'transparent' }]}
                  testID={`calm-sound-${s}`}
                >
                  <Feather name={s === 'none' ? 'volume-x' : s === 'rain' ? 'cloud-drizzle' : s === 'waves' ? 'wind' : 'feather'} size={14} color={on ? colors.background : colors.text} />
                  <AppText variant="caption" style={{ color: on ? colors.background : colors.text }}>
                    {AMBIENT_LABEL[s]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soundBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: 240, height: 240 },
  stageText: { alignItems: 'center', justifyContent: 'center' },
  circle: { width: 240, height: 240, borderRadius: 120, borderWidth: 2 },
  sounds: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  sound: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
});
