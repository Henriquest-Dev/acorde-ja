import {
  MINUTE,
  RuleState,
  addDays,
  dayKey,
  formatDuration,
  formatHoursMinutes,
  formatShortDate,
  greeting,
  todaySummary,
} from '@acorde/core';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AnimatedNumber,
  AppBarChart,
  AppButton,
  AppCard,
  FadeInItem,
  LivePulse,
  PressableScale,
  AppErrorState,
  AppProgressBar,
  AppProgressRing,
  AppSkeleton,
  AppText,
  AppUsageCard,
  HeaderIconButton,
  Screen,
  SectionTitle,
} from '@/components';
import { quoteOfTheDay } from '@/features/dashboard/quotes';
import { LimitEditorSheet } from '@/features/limits/LimitEditorSheet';
import { useActiveChallenges, useHabitsWeek, useHourly, useLimits, useReport, useToday } from '@/hooks/queries';
import type { AppLimit } from '@/repositories/limits';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Dashboard — visão geral do dia, sempre com dados reais autorizados. */
export default function Dashboard() {
  const { colors } = useTheme();
  const now = new Date();
  const today = useToday();
  const week = useReport('week', now);
  const habits = useHabitsWeek(now);
  const { data: limits } = useLimits();
  const focusMinutes = usePrefs((s) => s.prefs.focus.minutes);
  const [editing, setEditing] = useState<AppLimit | null>(null);
  const snap = today.data;
  const hourly = useHourly();
  const challenges = useActiveChallenges();

  const openApp = (appId: string, state: string) => {
    if (state === RuleState.BLOCKED || state === RuleState.SCHEDULED_BLOCK) router.push({ pathname: '/block', params: { appId } });
    else if (state === RuleState.WARNING) router.push({ pathname: '/limit-warning', params: { appId } });
    else setEditing(limits?.find((l) => l.appId === appId) ?? null);
  };

  const habitToday = habits.data ? todaySummary(habits.data.habits, habits.data.entries, now) : null;
  const weekTotal = week.data?.screen.hasData ? week.data.screen.totalMs : null;

  return (
    <Screen refreshing={today.isRefetching} onRefresh={() => void today.refetch()} testID="dashboard">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="h2" style={{ fontSize: 24 }} accessibilityRole="header">
            {greeting(now)}
          </AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {formatShortDate(now)}
          </AppText>
        </View>
        <HeaderIconButton icon="settings" label="Configurações" onPress={() => router.push('/settings')} />
      </View>
      <AppText variant="small" tone="secondary" style={styles.quote}>
        “{quoteOfTheDay(now)}”
      </AppText>

      {today.isLoading ? (
        <View style={{ alignItems: 'center', marginVertical: spacing.xxl }}>
          <AppSkeleton width={190} height={190} radius={95} />
        </View>
      ) : today.isError ? (
        <AppErrorState message="Não foi possível ler os dados de utilização." onRetry={() => void today.refetch()} />
      ) : snap ? (
        <>
          <View style={{ alignItems: 'center', marginVertical: spacing.xl }}>
            <AppProgressRing
              progress={snap.measured ? snap.totals.ratio : 0}
              size={190}
              strokeWidth={9}
              accessibilityLabel={
                snap.measured
                  ? `Utilizou ${formatDuration(snap.totals.usedMs)} de ${formatHoursMinutes(snap.totals.limitMs)} permitidos`
                  : 'Utilização indisponível'
              }
            >
              {snap.measured ? (
                <AnimatedNumber
                  value={Math.floor(snap.totals.usedMs / MINUTE)}
                  format={(n) => formatDuration(Math.round(n) * MINUTE)}
                  variant="h1"
                  style={{ fontSize: 30 }}
                  testID="ring-used"
                />
              ) : (
                <AppText variant="h1" style={{ fontSize: 30 }} testID="ring-used">
                  —
                </AppText>
              )}
              <AppText variant="caption" tone="muted">
                de {formatHoursMinutes(snap.totals.limitMs)}
              </AppText>
            </AppProgressRing>
          </View>

          {!snap.measured ? (
            <AppCard style={{ marginBottom: spacing.lg }} testID="usage-unavailable">
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Feather name="info" size={18} color={colors.text} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="bodyStrong">Dados de utilização indisponíveis</AppText>
                  <AppText variant="small" tone="muted">
                    {snap.capabilities.platform === 'web'
                      ? 'Na versão web não é possível medir o tempo nas aplicações. Utilize o aplicativo Android ou iOS.'
                      : snap.capabilities.platform === 'ios'
                        ? 'No iOS a Apple não disponibiliza os minutos de cada aplicação ao Acorde Já. Os limites são aplicados pelo Tempo de Ecrã.'
                        : 'Conceda o acesso aos dados de utilização para ver o seu tempo real. Não mostramos valores estimados.'}
                  </AppText>
                </View>
              </View>
              {snap.capabilities.platform === 'android' ? (
                <AppButton label="Configurar" size="sm" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => router.push('/settings/permissions')} />
              ) : null}
            </AppCard>
          ) : null}

          <View style={styles.appsHeader}>
            <AppText variant="caption" tone="muted">
              {countingNote(snap.apps)}
            </AppText>
            <Pressable onPress={() => router.push('/settings/limits')} accessibilityRole="button" hitSlop={8} testID="manage-apps">
              <AppText variant="caption" weight="semibold">
                Gerir aplicações
              </AppText>
            </Pressable>
          </View>
          <View style={{ gap: spacing.xs }}>
            {snap.apps.map((a, i) => (
              <FadeInItem key={a.appId} index={i}>
                <AppUsageCard
                  appId={a.appId}
                  name={a.name}
                  usedMin={snap.measured ? Math.floor(a.usedMs / MINUTE) : null}
                  limitMin={a.limitMinutes}
                  state={a.state}
                  onPress={() => openApp(a.appId, a.state)}
                />
              </FadeInItem>
            ))}
          </View>

          {snap.measured ? (
            <View style={styles.stats}>
              <Stat label="Tempo de ecrã" value={snap.screenTimeMs !== null ? formatDuration(snap.screenTimeMs) : '—'} />
              <Stat label="Restante" value={formatDuration(snap.totals.remainingMs)} />
              <Stat label="Bloqueadas" value={String(snap.totals.blockedCount)} />
            </View>
          ) : null}
        </>
      ) : null}

      {challenges.data?.length ? (
        <FadeInItem index={2}>
          <PressableScale onPress={() => router.push('/challenge')} accessibilityRole="button" style={[styles.challenge, { backgroundColor: colors.card, borderColor: colors.borderStrong }]} testID="challenge-card">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Feather name="award" size={22} color={colors.text} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{challenges.data[0]!.label}</AppText>
                <AppText variant="caption" tone="muted">
                  Dia {challenges.data[0]!.stats.dayNumber} de {challenges.data[0]!.stats.total} · sequência de {challenges.data[0]!.stats.currentStreak}
                </AppText>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </View>
            <AppProgressBar progress={challenges.data[0]!.stats.progress} style={{ marginTop: spacing.md }} />
          </PressableScale>
        </FadeInItem>
      ) : null}

      {hourly.data ? (
        <>
          <SectionTitle
            action={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LivePulse color={colors.text} />
                <AppText variant="caption" tone="muted">
                  ao vivo
                </AppText>
              </View>
            }
          >
            Hoje, hora a hora
          </SectionTitle>
          <AppCard>
            <AppBarChart
              data={hourly.data.map((ms, h) => ({
                key: String(h),
                label: h % 6 === 0 ? `${h}h` : '',
                value: ms,
                valueLabel: `${h}h–${h + 1}h · ${formatDuration(ms)}`,
              }))}
              highlightKey={String(now.getHours())}
              height={90}
              testID="hourly-chart"
            />
          </AppCard>
        </>
      ) : null}

      <SectionTitle>Agora</SectionTitle>
      <View style={styles.quickRow}>
        <QuickAction icon="clock" label={`Foco ${focusMinutes} min`} onPress={() => router.push({ pathname: '/focus', params: { autostart: '1' } })} />
        <QuickAction icon="wind" label="Respirar" onPress={() => router.push('/breathing')} />
        <QuickAction icon="life-buoy" label="Preciso de ajuda" onPress={() => router.push('/help-now')} />
      </View>

      <SectionTitle action={<LinkText label="Ver todos" onPress={() => router.push('/habits')} />}>Hábitos de hoje</SectionTitle>
      <AppCard onPress={() => router.push('/habits')}>
        {habitToday && habitToday.due > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" tone="secondary">
              {habitToday.done} de {habitToday.due} concluídos
            </AppText>
            <AppProgressBar progress={habitToday.done / habitToday.due} />
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            Ainda não tem hábitos. Crie o primeiro — por exemplo, ler 20 minutos.
          </AppText>
        )}
      </AppCard>

      <SectionTitle action={<LinkText label="Relatórios" onPress={() => router.push('/progress')} />}>Esta semana</SectionTitle>
      <AppCard>
        {weekTotal !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <AppText variant="h3">{formatDuration(weekTotal)}</AppText>
              <AppText variant="caption" tone="muted">
                tempo de ecrã desde {formatShortDate(addDays(now, -((now.getDay() + 6) % 7)))}
              </AppText>
            </View>
            {week.data?.change !== null && week.data?.change !== undefined ? (
              <AppText variant="small" tone="secondary">
                {week.data.change <= 0 ? '↓' : '↑'} {Math.abs(week.data.change)}%
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            O resumo semanal aparece quando houver dados de utilização registados.
          </AppText>
        )}
      </AppCard>

      <AppCard style={{ marginTop: spacing.lg }} onPress={() => router.push('/assistant')} accessibilityLabel="Falar com o assistente">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <MaterialCommunityIcons name="robot-outline" size={24} color={colors.text} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Assistente Acorde Já</AppText>
            <AppText variant="caption" tone="muted">
              Apoio em momentos de impulso e planos de redução.
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </View>
      </AppCard>
      <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.xl }}>
        Actualizado às {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')} · {dayKey(now)}
      </AppText>

      <LimitEditorSheet limit={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function countingNote(apps: { countingSince: number | null }[]): string {
  const since = apps.map((a) => a.countingSince).filter((x): x is number => x !== null);
  if (since.length === 0) return 'Utilização de hoje';
  const d = new Date(Math.min(...since));
  return `A contar desde as ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="bodyStrong">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.quick, { backgroundColor: colors.card, borderColor: colors.border }]} scaleTo={0.94}>
      <Feather name={icon} size={20} color={colors.text} />
      <AppText variant="caption" align="center">
        {label}
      </AppText>
    </PressableScale>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  quote: { marginTop: spacing.lg, maxWidth: 290, fontSize: 13, lineHeight: 19 },
  stats: { flexDirection: 'row', marginTop: spacing.lg },
  quickRow: { flexDirection: 'row', gap: spacing.md },
  appsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  challenge: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: 16, borderWidth: 1 },
  quick: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.lg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
