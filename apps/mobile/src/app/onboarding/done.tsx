import { GOALS } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { AppButton, AppText, Screen } from '@/components';
import { PermissionStatusIcon } from '@/features/onboarding/PermissionStatusIcon';
import { activateEnforcement, usePermissionSummary } from '@/features/onboarding/usePermissionSummary';
import { useLimits } from '@/hooks/queries';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** ONB-05 — Conclusão: resumo real do que ficou configurado. */
export default function Done() {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const { prefs, update } = usePrefs();
  const { data: limits } = useLimits();
  const { data: perms } = usePermissionSummary();
  const [finishing, setFinishing] = useState(false);
  const allGranted = perms?.items.every((i) => i.state === 'granted') ?? false;
  const goals = GOALS.filter((g) => prefs.goals.includes(g.id));
  const active = (limits ?? []).filter((l) => l.enabled);

  const finish = async () => {
    setFinishing(true);
    await activateEnforcement().catch(() => false);
    await update({ onboardingDone: true });
    router.replace('/');
  };

  return (
    <Screen testID="onb-done" footer={<AppButton label="Ir para o início" onPress={finish} loading={finishing} testID="onb-finish" />}>
      <View style={{ alignItems: 'center', marginTop: spacing.huge }}>
        <Animated.View entering={reduce ? undefined : ZoomIn.springify()} style={[styles.check, { borderColor: colors.text }]}>
          <Feather name="check" size={40} color={colors.text} />
        </Animated.View>
        <AppText variant="h2" align="center" style={{ marginTop: spacing.xxl }} accessibilityRole="header">
          Está tudo pronto!
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={{ marginTop: spacing.md, maxWidth: 260 }}>
          {allGranted
            ? 'O Acorde Já já está a proteger o seu tempo. Vamos nessa!'
            : 'O Acorde Já está configurado. Algumas protecções precisam de permissões — pode activá-las quando quiser.'}
        </AppText>
      </View>

      <View style={[styles.summary, { borderColor: colors.border }]}>
        <AppText variant="overline" tone="muted">
          OBJECTIVOS
        </AppText>
        <AppText variant="small" tone="secondary">
          {goals.length ? goals.map((g) => g.label).join(' · ') : 'Nenhum seleccionado'}
        </AppText>
        <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
          LIMITES
        </AppText>
        <AppText variant="small" tone="secondary">
          {active.length ? active.map((l) => `${l.name} ${l.limitMinutes} min`).join(' · ') : 'Sem limites activos'}
        </AppText>
        <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
          PERMISSÕES
        </AppText>
        {perms?.items.map((i) => (
          <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
            <PermissionStatusIcon state={i.state} />
            <AppText variant="small" tone="secondary" style={{ flex: 1 }}>
              {i.title}
              {i.state === 'unsupported' ? ' — indisponível neste dispositivo' : i.state !== 'granted' ? ' — pendente' : ''}
            </AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  summary: { marginTop: spacing.xxxl, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.lg, gap: 4 },
});
