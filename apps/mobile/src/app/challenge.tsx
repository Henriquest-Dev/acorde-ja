import {
  canCheckIn,
  challengeCalendar,
  challengeEndsAt,
  formatDayMonth,
  type CalendarDay,
  type ChallengeGoal,
  type Reward,
} from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import {
  AnimatedNumber,
  AppBottomSheet,
  AppButton,
  AppCard,
  AppHeader,
  AppProgressRing,
  AppSkeleton,
  AppText,
  Breathe,
  FadeInItem,
  LivePulse,
  PressableScale,
  Screen,
  SectionTitle,
  SegmentedControl,
} from '@/components';
import { ChallengeSetup } from '@/features/challenge/ChallengeSetup';
import { useActiveChallenges } from '@/hooks/queries';
import { shield } from '@/native/device';
import { checkIn } from '@/services/challenge';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/** Desafio — calendário de recompensas, check-in diário e protecção trancada. */
export default function ChallengeScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const goals = usePrefs((s) => s.prefs.goals);
  const { data, isLoading, refetch } = useActiveChallenges();
  const [tab, setTab] = useState(0);
  const [reveal, setReveal] = useState<Reward | null>(null);
  const [detail, setDetail] = useState<CalendarDay | null>(null);
  const [relapseInfo, setRelapseInfo] = useState(false);
  const shieldStatus = useQuery({ queryKey: ['shield-status-challenge'], queryFn: () => shield.stats(), refetchInterval: 15_000 });

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title="O seu desafio" back />
        <AppSkeleton height={220} radius={20} />
      </Screen>
    );
  }

  if (!data?.length) {
    const initial = goals.filter((g): g is ChallengeGoal => g === 'avoid_porn' || g === 'avoid_gambling');
    return (
      <Screen>
        <AppHeader title="Novo desafio" back />
        <ChallengeSetup initialGoals={initial} onDone={() => void refetch()} />
      </Screen>
    );
  }

  const current = data[Math.min(tab, data.length - 1)]!;
  const { challenge, checkins, stats } = current;
  const now = new Date();
  const calendar = challengeCalendar(challenge, checkins, now);
  const todayCell = calendar.find((d) => d.status === 'today');
  const open = canCheckIn(challenge, checkins, now);

  const record = async (status: 'clean' | 'relapse') => {
    await checkIn(challenge, status, now);
    await qc.invalidateQueries({ queryKey: ['challenges'] });
    if (status === 'clean' && todayCell) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setReveal(todayCell.reward);
    } else {
      setRelapseInfo(true);
    }
  };

  return (
    <Screen testID="challenge">
      <AppHeader title="O seu desafio" back />
      {data.length > 1 ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SegmentedControl options={data.map((d, i) => ({ value: String(i), label: d.label }))} value={String(tab)} onChange={(v) => setTab(Number(v))} />
        </View>
      ) : null}

      <FadeInItem index={0} style={{ alignItems: 'center' }}>
        <AppProgressRing progress={stats.progress} size={200} strokeWidth={10} accessibilityLabel={`Dia ${stats.dayNumber} de ${stats.total}`}>
          <AppText variant="caption" tone="muted">
            DIA
          </AppText>
          <AnimatedNumber value={stats.dayNumber} format={(n) => String(Math.round(n))} variant="display" style={{ fontSize: 48 }} />
          <AppText variant="caption" tone="muted">
            de {stats.total}
          </AppText>
        </AppProgressRing>
        <AppText variant="bodyStrong" style={{ marginTop: spacing.md }}>
          {current.label}
        </AppText>
        <AppText variant="small" tone="muted">
          Faltam {stats.daysLeft} dias · termina a {formatDayMonth(new Date(challengeEndsAt(challenge) - 1))}
        </AppText>
      </FadeInItem>

      <FadeInItem index={1} style={styles.stats}>
        <Stat label="Sequência" value={stats.currentStreak} />
        <Stat label="Melhor" value={stats.bestStreak} />
        <Stat label="Recompensas" value={stats.rewardsUnlocked.length} />
      </FadeInItem>

      {open ? (
        <FadeInItem index={2}>
          <AppCard style={{ marginTop: spacing.xl }}>
            <AppText variant="bodyStrong">Como correu hoje?</AppText>
            <AppText variant="small" tone="muted" style={{ marginTop: 2 }}>
              Seja honesto consigo: o calendário é só seu.
            </AppText>
            <Breathe style={{ marginTop: spacing.lg }} amount={0.02}>
              <AppButton label="Mantive-me firme hoje" onPress={() => void record('clean')} testID="checkin-clean" />
            </Breathe>
            <AppButton label="Tive uma recaída" variant="ghost" size="sm" onPress={() => void record('relapse')} style={{ marginTop: spacing.sm }} />
          </AppCard>
        </FadeInItem>
      ) : null}

      <SectionTitle>Calendário de recompensas</SectionTitle>
      <View style={styles.grid}>
        {calendar.map((d, i) => (
          <DayCell key={d.day} day={d} index={i} onPress={() => setDetail(d)} />
        ))}
      </View>

      <SectionTitle>Protecção trancada</SectionTitle>
      <AppCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Feather name="lock" size={20} color={colors.text} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Até {formatDayMonth(new Date(challengeEndsAt(challenge) - 1))}</AppText>
            <AppText variant="caption" tone="muted">
              {shieldStatus.data?.running ? 'Filtro de sites activo' : 'Filtro de sites a ligar…'} · {shieldStatus.data?.blockedToday ?? 0} bloqueios hoje
            </AppText>
          </View>
          {shieldStatus.data?.running ? <LivePulse color={colors.text} /> : null}
        </View>
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
          Dica: em Definições → Rede → VPN → Acorde Já, active «VPN sempre activa» e «Bloquear ligações sem VPN» para reforçar o
          compromisso.
        </AppText>
      </AppCard>

      <AppBottomSheet visible={reveal !== null} onClose={() => setReveal(null)}>
        {reveal ? <RewardReveal reward={reveal} onClose={() => setReveal(null)} /> : null}
      </AppBottomSheet>

      <AppBottomSheet visible={detail !== null} onClose={() => setDetail(null)} title={detail ? `Dia ${detail.index}` : undefined}>
        {detail ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.lg }}>
            <Feather name={(detail.status === 'clean' ? detail.reward.icon : 'gift') as never} size={36} color={colors.text} />
            <AppText variant="h3">{detail.status === 'clean' ? detail.reward.title : detail.reward.milestone ? 'Recompensa especial' : 'Recompensa por desbloquear'}</AppText>
            <AppText variant="small" tone="muted" align="center">
              {detail.status === 'clean'
                ? detail.reward.message
                : detail.status === 'relapse'
                  ? 'Neste dia houve uma recaída. Não apaga o caminho que já fez.'
                  : detail.status === 'missed'
                    ? 'Este dia não foi registado.'
                    : `Mantenha-se firme neste dia para a desbloquear${detail.reward.milestone ? ` — «${detail.reward.title}»` : ''}.`}
            </AppText>
          </View>
        ) : null}
      </AppBottomSheet>

      <AppBottomSheet visible={relapseInfo} onClose={() => setRelapseInfo(false)} title="Está tudo bem recomeçar">
        <AppText variant="body" tone="secondary">
          Uma recaída não apaga os dias que venceu. O desafio continua e a protecção mantém-se. Amanhã é um dia novo — e se precisar
          de apoio agora, use «Preciso de ajuda agora».
        </AppText>
        <AppButton label="Continuar" onPress={() => setRelapseInfo(false)} style={{ marginTop: spacing.xl }} />
      </AppBottomSheet>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AnimatedNumber value={value} format={(n) => String(Math.round(n))} variant="h2" />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function DayCell({ day, index, onPress }: { day: CalendarDay; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const filled = day.status === 'clean';
  const icon = filled ? day.reward.icon : day.status === 'relapse' ? 'x' : day.status === 'missed' ? 'minus' : day.reward.milestone ? 'gift' : null;
  const cell = (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Dia ${day.index}: ${day.status}`}
      style={[
        styles.cell,
        {
          backgroundColor: filled ? colors.accent : colors.card,
          borderColor: day.status === 'today' ? colors.text : colors.border,
          borderWidth: day.status === 'today' ? 2 : StyleSheet.hairlineWidth,
          opacity: day.status === 'future' ? 0.55 : day.status === 'missed' ? 0.4 : 1,
        },
      ]}
      scaleTo={0.9}
    >
      <AppText variant="caption" style={{ fontSize: 10, color: filled ? colors.onAccent : colors.textMuted }}>
        {day.index}
      </AppText>
      {icon ? <Feather name={icon as never} size={14} color={filled ? colors.onAccent : colors.text} /> : <View style={{ height: 14 }} />}
    </PressableScale>
  );
  return (
    <Animated.View entering={reduce ? undefined : ZoomIn.delay(Math.min(index, 40) * 12).duration(260)}>
      {day.status === 'today' ? <Breathe amount={0.06}>{cell}</Breathe> : cell}
    </Animated.View>
  );
}

function RewardReveal({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
      <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(9)} style={[styles.reveal, { backgroundColor: colors.accent }]}>
        <Feather name={reward.icon as never} size={44} color={colors.onAccent} />
      </Animated.View>
      <AppText variant="overline" tone="muted">
        {reward.milestone ? 'MARCO DESBLOQUEADO' : 'RECOMPENSA DE HOJE'}
      </AppText>
      <AppText variant="h2" align="center">
        {reward.title}
      </AppText>
      <AppText variant="body" tone="secondary" align="center">
        {reward.message}
      </AppText>
      <AppButton label="Obrigado" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', marginTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 42, height: 50, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
  reveal: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
