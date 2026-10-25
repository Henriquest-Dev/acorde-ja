import { CHALLENGE_PRESETS, MAX_CHALLENGE_DAYS, MIN_CHALLENGE_DAYS, addDays, formatDayMonth, type ChallengeGoal } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppCard, AppCheckbox, AppSlider, AppText, Breathe, FadeInItem, PressableScale, toast } from '@/components';
import { GOAL_LABEL, startChallenges } from '@/services/challenge';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/**
 * Configuração do desafio: objectivos (pornografia / apostas) e data-limite.
 * Ao aceitar, a protecção de sites correspondente fica bloqueada até essa data.
 */
export function ChallengeSetup({ initialGoals, onDone, onSkip }: { initialGoals: ChallengeGoal[]; onDone: () => void; onSkip?: () => void }) {
  const { colors } = useTheme();
  const [goals, setGoals] = useState<ChallengeGoal[]>(initialGoals.length ? initialGoals : ['avoid_porn']);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const end = addDays(new Date(), days - 1);

  const toggle = (g: ChallengeGoal) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const accept = async () => {
    setBusy(true);
    try {
      const r = await startChallenges(goals, days);
      toast(r.length > 1 ? 'Desafios aceites. Começa hoje!' : 'Desafio aceite. Começa hoje!');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível criar o desafio', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <FadeInItem index={0} style={{ alignItems: 'center' }}>
        <Breathe>
          <View style={[styles.badge, { borderColor: colors.text }]}>
            <Feather name="award" size={34} color={colors.text} />
          </View>
        </Breathe>
      </FadeInItem>

      <FadeInItem index={1} style={{ gap: spacing.sm }}>
        {(['avoid_porn', 'avoid_gambling'] as ChallengeGoal[]).map((g) => (
          <PressableScale
            key={g}
            onPress={() => toggle(g)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: goals.includes(g) }}
            style={[styles.goal, { backgroundColor: colors.card, borderColor: goals.includes(g) ? colors.text : colors.border }]}
          >
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {GOAL_LABEL[g]}
            </AppText>
            <AppCheckbox checked={goals.includes(g)} onChange={() => toggle(g)} accessibilityLabel={GOAL_LABEL[g]} />
          </PressableScale>
        ))}
      </FadeInItem>

      <FadeInItem index={2}>
        <AppText variant="small" tone="secondary">
          Durante quanto tempo?
        </AppText>
        <View style={styles.presets}>
          {CHALLENGE_PRESETS.map((p) => (
            <PressableScale
              key={p.days}
              onPress={() => setDays(p.days)}
              accessibilityRole="radio"
              accessibilityState={{ selected: days === p.days }}
              style={[styles.preset, { borderColor: colors.border, backgroundColor: days === p.days ? colors.accent : 'transparent' }]}
            >
              <AppText variant="small" weight="semibold" style={{ color: days === p.days ? colors.onAccent : colors.text }}>
                {p.label}
              </AppText>
            </PressableScale>
          ))}
        </View>
        <AppSlider value={days} min={MIN_CHALLENGE_DAYS} max={MAX_CHALLENGE_DAYS} onChange={setDays} accessibilityLabel="Duração do desafio em dias" formatValue={(v) => `${v} dias`} />
        <AppText variant="h3" align="center" style={{ marginTop: spacing.md }} testID="challenge-end">
          {days} dias · até {formatDayMonth(end)}
        </AppText>
      </FadeInItem>

      <FadeInItem index={3}>
        <AppCard>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Feather name="lock" size={18} color={colors.text} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong">A protecção fica trancada</AppText>
              <AppText variant="small" tone="muted">
                Até {formatDayMonth(end)} não poderá desligar o bloqueio de sites no Acorde Já. Se desligar a VPN nas definições do
                sistema, o Acorde Já volta a ligá-la. Todos os dias em que se mantiver firme ganha uma recompensa.
              </AppText>
            </View>
          </View>
        </AppCard>
      </FadeInItem>

      <View style={{ gap: spacing.sm }}>
        <AppButton label="Aceitar o desafio" onPress={accept} loading={busy} disabled={goals.length === 0} testID="challenge-accept" />
        {onSkip ? <AppButton label="Agora não" variant="ghost" onPress={onSkip} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  goal: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radii.md, borderWidth: 1 },
  presets: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.md, borderWidth: 1 },
});
