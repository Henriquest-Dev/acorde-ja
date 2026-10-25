import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { goBack } from '@/navigation/goBack';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppRadioGroup, AppText, Screen } from '@/components';
import { preferredStrategies, saveHelpOutcome } from '@/repositories/chat';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Difficulty = 'app_urge' | 'porn_urge' | 'gambling_urge' | 'stress' | 'sleep' | 'other';
type Goal = 'resist' | 'calm' | 'distract' | 'talk';
type Strategy = 'breathing' | 'focus' | 'walk' | 'call' | 'water';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'app_urge', label: 'Vontade de abrir uma aplicação' },
  { value: 'porn_urge', label: 'Vontade de ver pornografia' },
  { value: 'gambling_urge', label: 'Vontade de apostar' },
  { value: 'stress', label: 'Ansiedade ou stress' },
  { value: 'sleep', label: 'Não consigo dormir' },
  { value: 'other', label: 'Outra coisa' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'resist', label: 'Aguentar os próximos 10 minutos' },
  { value: 'calm', label: 'Acalmar-me' },
  { value: 'distract', label: 'Mudar o foco para outra coisa' },
  { value: 'talk', label: 'Falar com alguém' },
];

const INTERVENTION: Record<Difficulty, string> = {
  app_urge: 'Os impulsos sobem como uma onda e descem sozinhos, normalmente em poucos minutos. Não precisa de lutar contra ele — só de esperar que passe.',
  porn_urge: 'Repare no impulso sem o julgar. Mude de divisão, acenda a luz e afaste o telemóvel de si durante 10 minutos.',
  gambling_urge: 'O impulso de apostar costuma vir com a ideia de "recuperar". Escreva quanto já perdeu e o que esse dinheiro significa para si.',
  stress: 'Quando estamos tensos, o telemóvel parece um refúgio rápido. Abrandar a respiração acalma o corpo em pouco tempo.',
  sleep: 'A luz e o estímulo do ecrã afastam o sono. Pouse o telemóvel longe da cama e respire devagar no escuro.',
  other: 'Pare por um momento. Nomeie o que está a sentir — só isso já reduz a intensidade.',
};

const STRATEGIES: { value: Strategy; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { value: 'breathing', label: 'Respirar 2 minutos', icon: 'wind' },
  { value: 'walk', label: 'Caminhar 5 minutos', icon: 'navigation' },
  { value: 'water', label: 'Beber um copo de água', icon: 'droplet' },
  { value: 'focus', label: 'Sessão de foco', icon: 'clock' },
  { value: 'call', label: 'Ligar a alguém de confiança', icon: 'phone' },
];

const STRATEGY_LABEL = Object.fromEntries(STRATEGIES.map((s) => [s.value, s.label])) as Record<string, string>;

/** «Preciso de ajuda agora» — intervenção breve, voluntária e offline. */
export default function HelpNow() {
  const { colors } = useTheme();
  const aiMemory = usePrefs((s) => s.prefs.aiMemory);
  const [step, setStep] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('app_urge');
  const [goal, setGoal] = useState<Goal>('resist');
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [outcomeId] = useState(randomUUID());
  const preferred = useQuery({ queryKey: ['preferred-strategies'], queryFn: preferredStrategies, enabled: aiMemory });

  const choose = async (s: Strategy) => {
    setStrategy(s);
    await saveHelpOutcome({ id: outcomeId, difficulty, strategy: s, outcome: null, createdAt: Date.now() });
    if (s === 'breathing') router.push('/breathing');
    if (s === 'focus') router.push({ pathname: '/focus', params: { autostart: '1' } });
    setStep(4);
  };

  const record = async (outcome: 'helped' | 'partly' | 'not_helped') => {
    await saveHelpOutcome({ id: outcomeId, difficulty, strategy: strategy ?? 'none', outcome, createdAt: Date.now() });
    goBack();
  };

  return (
    <Screen
      footer={
        step === 0 ? (
          <AppButton label="Continuar" onPress={() => setStep(1)} />
        ) : step === 1 ? (
          <AppButton label="Continuar" onPress={() => setStep(goal === 'talk' ? 3 : 2)} />
        ) : step === 2 ? (
          <AppButton label="Escolher uma actividade" onPress={() => setStep(3)} />
        ) : null
      }
    >
      <AppHeader title="Preciso de ajuda agora" back />
      <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.lg }}>
        Passo {Math.min(step + 1, 5)} de 5
      </AppText>

      {step === 0 ? (
        <>
          <AppText variant="h3" style={{ marginBottom: spacing.lg }}>
            O que está a ser difícil agora?
          </AppText>
          <AppRadioGroup options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        </>
      ) : step === 1 ? (
        <>
          <AppText variant="h3" style={{ marginBottom: spacing.lg }}>
            O que gostaria de conseguir agora?
          </AppText>
          <AppRadioGroup options={GOALS} value={goal} onChange={setGoal} />
        </>
      ) : step === 2 ? (
        <AppCard>
          <Feather name="feather" size={22} color={colors.text} />
          <AppText variant="body" style={{ marginTop: spacing.md }}>
            {INTERVENTION[difficulty]}
          </AppText>
          {difficulty === 'gambling_urge' ? (
            <AppText variant="small" tone="muted" style={{ marginTop: spacing.md }}>
              Pode pedir a autoexclusão dos sites de jogo legais junto do SRIJ, em Proteção.
            </AppText>
          ) : null}
        </AppCard>
      ) : step === 3 ? (
        <>
          <AppText variant="h3" style={{ marginBottom: spacing.lg }}>
            Escolha uma alternativa
          </AppText>
          {aiMemory && preferred.data?.length ? (
            <AppText variant="small" tone="muted" style={{ marginBottom: spacing.md }}>
              Da última vez ajudou: {preferred.data.map((p) => STRATEGY_LABEL[p.strategy] ?? p.strategy).join(', ')}
            </AppText>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            {(goal === 'talk' ? [...STRATEGIES].sort((a) => (a.value === 'call' ? -1 : 1)) : STRATEGIES).map((s) => (
              <AppButton key={s.value} label={s.label} variant="subtle" onPress={() => void choose(s.value)} leading={<Feather name={s.icon} size={18} color={colors.text} />} />
            ))}
          </View>
        </>
      ) : (
        <>
          <AppText variant="h3">Como se sente agora?</AppText>
          <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
            Registar o resultado ajuda a perceber o que funciona para si. Fica apenas no seu dispositivo.
          </AppText>
          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
            <AppButton label="Melhor — ajudou" onPress={() => void record('helped')} />
            <AppButton label="Um pouco melhor" variant="secondary" onPress={() => void record('partly')} />
            <AppButton label="Não ajudou" variant="ghost" onPress={() => void record('not_helped')} />
          </View>
        </>
      )}

      <AppCard style={{ marginTop: spacing.xxxl }}>
        <AppText variant="small" weight="semibold">
          Se estiver em perigo ou a pensar fazer-se mal
        </AppText>
        <AppText variant="small" tone="secondary" style={{ marginTop: spacing.xs }}>
          Ligue 112. Para aconselhamento psicológico, contacte o SNS 24 (808 24 24 24). O Acorde Já não substitui ajuda profissional.
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md }}>
          <AppText variant="small" style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL('tel:112')}>
            Ligar 112
          </AppText>
          <AppText variant="small" style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL('tel:808242424')}>
            Ligar SNS 24
          </AppText>
        </View>
      </AppCard>
    </Screen>
  );
}
