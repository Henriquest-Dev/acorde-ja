import type { ChallengeGoal } from '@acorde/core';
import { router } from 'expo-router';
import { AppText, Screen } from '@/components';
import { ChallengeSetup } from '@/features/challenge/ChallengeSetup';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** Onboarding — desafio (só para quem escolheu evitar pornografia ou apostas). */
export default function OnboardingChallenge() {
  const goals = usePrefs((s) => s.prefs.goals);
  const initial = goals.filter((g): g is ChallengeGoal => g === 'avoid_porn' || g === 'avoid_gambling');
  const next = () => router.push('/onboarding/limits');
  return (
    <Screen testID="onb-challenge">
      <AppText variant="h2" style={{ marginTop: spacing.xl, fontSize: 24, lineHeight: 30 }} accessibilityRole="header">
        O seu desafio
      </AppText>
      <AppText variant="body" tone="secondary" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        Escolha até quando se compromete. Cada dia vencido desbloqueia uma recompensa no seu calendário.
      </AppText>
      <ChallengeSetup initialGoals={initial} onDone={next} onSkip={next} />
    </Screen>
  );
}
