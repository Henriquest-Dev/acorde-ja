import { GOALS, type GoalId } from '@acorde/core';
import { GOAL_ICONS } from '@/features/onboarding/goalIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton, AppCheckbox, AppText, RowIconView, Screen } from '@/components';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';


/** ONB-02 — Objectivos (escolha múltipla). */
export default function Goals() {
  const goals = usePrefs((s) => s.prefs.goals);
  const update = usePrefs((s) => s.update);

  const toggle = (id: GoalId) => update((p) => ({ goals: p.goals.includes(id) ? p.goals.filter((g) => g !== id) : [...p.goals, id] }));

  return (
    <Screen
      testID="onb-goals"
      footer={<AppButton label="Continuar" disabled={goals.length === 0} onPress={() => router.push('/onboarding/limits')} testID="onb-goals-continue" />}
    >
      <AppText variant="h2" style={styles.title} accessibilityRole="header">
        Quais são os seus principais objetivos?
      </AppText>
      <View style={{ gap: 2 }}>
        {GOALS.map((g) => {
          const checked = goals.includes(g.id);
          return (
            <Pressable key={g.id} onPress={() => toggle(g.id)} style={styles.row} accessibilityLabel={g.label} accessibilityRole="checkbox" accessibilityState={{ checked }}>
              <View style={styles.icon}>
                <RowIconView icon={GOAL_ICONS[g.id]} />
              </View>
              <AppText variant="small" style={{ flex: 1, fontSize: 14 }}>
                {g.label}
              </AppText>
              <AppCheckbox checked={checked} onChange={() => toggle(g.id)} accessibilityLabel={g.label} testID={`goal-${g.id}`} />
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xl }}>
        Pode escolher vários. Os objectivos ficam apenas no seu dispositivo, a menos que active a sincronização.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xl, marginBottom: spacing.xxl, fontSize: 24, lineHeight: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  icon: { width: 32, alignItems: 'center' },
});
