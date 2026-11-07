import { MINUTE } from '@acorde/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppProgressRing, AppText, PressableScale, toast } from '@/components';
import { useToday } from '@/hooks/queries';
import { kvGet, kvSet } from '@/repositories/kv';
import { launchApp } from '@/services/launcher';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const REASONS = ['Responder a alguém', 'Por hábito', 'Trabalho', 'Tédio', 'Outro'];

interface IntentLog {
  pkg: string;
  reason: string;
  opened: boolean;
  at: number;
}

/** Pausa de intenção — alguns segundos de respiração antes de abrir uma app que distrai. */
export default function IntentionPause() {
  const { pkg, label } = useLocalSearchParams<{ pkg: string; label: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const seconds = usePrefs((s) => s.prefs.launcher.intentionSeconds);
  const today = useToday();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const total = Math.max(1, seconds) * 1000;
  const left = Math.max(0, total - (now - startedAt));
  const secs = Math.ceil(left / 1000);
  const limit = today.data?.apps.find((a) => a.packageNames.includes(pkg));

  const log = async (opened: boolean) => {
    const prev = await kvGet<IntentLog[]>('intentLog', []);
    await kvSet('intentLog', [{ pkg, reason: reason ?? 'sem motivo', opened, at: Date.now() }, ...prev].slice(0, 300));
  };

  const cancel = async () => {
    await log(false);
    toast('Boa escolha.');
    router.replace('/launcher');
  };

  const proceed = async () => {
    await log(true);
    const ok = await launchApp(pkg).catch(() => false);
    if (!ok) toast(`Não foi possível abrir ${label}.`, 'error');
    router.replace('/launcher');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xl }]} testID="launcher-pause">
      <Animated.View entering={reduce ? undefined : FadeIn.duration(350)} style={{ alignItems: 'center' }}>
        <AppText variant="body" tone="muted">
          Vai abrir o
        </AppText>
        <AppText variant="h1" style={{ marginTop: 2 }}>
          {label}
        </AppText>
        <View style={{ marginVertical: spacing.xxl }}>
          <AppProgressRing progress={1 - left / total} size={170} strokeWidth={6} accessibilityLabel={`Faltam ${secs} segundos`}>
            <AppText style={{ fontFamily: fonts.light, fontSize: 60, color: colors.text }}>{secs}</AppText>
          </AppProgressRing>
        </View>
        <AppText variant="small" tone="secondary">
          Respire. Porque está a abri-lo?
        </AppText>
        <View style={styles.chips}>
          {REASONS.map((r) => {
            const on = reason === r;
            return (
              <PressableScale
                key={r}
                onPress={() => setReason(on ? null : r)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { borderColor: on ? colors.text : colors.borderStrong, backgroundColor: on ? colors.accent : 'transparent' }]}
              >
                <AppText variant="small" style={{ color: on ? colors.onAccent : colors.text }}>
                  {r}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
        {limit && today.data?.measured ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
            {Math.floor(limit.usedMs / MINUTE)} de {limit.limitMinutes} min usados hoje
          </AppText>
        ) : null}
      </Animated.View>
      <View style={{ flex: 1 }} />
      <View style={{ gap: spacing.sm }}>
        <AppButton label="Afinal, não" onPress={() => void cancel()} testID="pause-cancel" />
        <AppButton label={left > 0 ? `Abrir em ${secs} s` : `Abrir ${label}`} variant="subtle" disabled={left > 0} onPress={() => void proceed()} testID="pause-open" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: spacing.lg },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9 },
});
