import { MINUTE, RuleState, formatDuration, formatHoursMinutes, formatShortDate, greeting, todaySummary } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppButton,
  AppCard,
  AppErrorState,
  AppProgressBar,
  AppSkeleton,
  AppText,
  AppUsageCard,
  FadeInItem,
  HeaderIconButton,
  ListRow,
  Screen,
} from '@/components';
import { LimitEditorSheet } from '@/features/limits/LimitEditorSheet';
import { useActiveChallenges, useHabitsWeek, useLimits, useToday } from '@/hooks/queries';
import type { AppLimit } from '@/repositories/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Máximo de apps na primeira vista; as restantes ficam em «Ver todas». */
const MAX_APPS = 4;

/**
 * Início — só o essencial: quanto tempo já usou hoje e as apps que importam.
 * Gráficos, hábitos e relatórios vivem nos respetivos separadores.
 */
export default function Dashboard() {
  const { colors } = useTheme();
  const now = new Date();
  const today = useToday();
  const habits = useHabitsWeek(now);
  const { data: limits } = useLimits();
  const challenges = useActiveChallenges();
  const [editing, setEditing] = useState<AppLimit | null>(null);
  const snap = today.data;

  const openApp = (appId: string, state: string) => {
    if (state === RuleState.BLOCKED || state === RuleState.SCHEDULED_BLOCK) router.push({ pathname: '/block', params: { appId } });
    else if (state === RuleState.WARNING) router.push({ pathname: '/limit-warning', params: { appId } });
    else setEditing(limits?.find((l) => l.appId === appId) ?? null);
  };

  const habitToday = habits.data ? todaySummary(habits.data.habits, habits.data.entries, now) : null;
  const challenge = challenges.data?.[0];
  // Apps mais próximas do limite primeiro: é o que interessa ver.
  const apps = snap ? [...snap.apps].sort((a, b) => b.usedMs / Math.max(1, b.limitMinutes) - a.usedMs / Math.max(1, a.limitMinutes)) : [];

  return (
    <Screen refreshing={today.isRefetching} onRefresh={() => void today.refetch()} testID="dashboard">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="muted">
            {formatShortDate(now)}
          </AppText>
          <AppText variant="h2" style={{ fontSize: 22 }} accessibilityRole="header">
            {greeting(now)}
          </AppText>
        </View>
        <HeaderIconButton icon="settings" label="Configurações" onPress={() => router.push('/settings')} />
      </View>

      {today.isLoading ? (
        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <AppSkeleton width={160} height={44} />
          <AppSkeleton height={4} />
        </View>
      ) : today.isError ? (
        <AppErrorState message="Não foi possível ler os dados de utilização." onRetry={() => void today.refetch()} />
      ) : snap ? (
        <>
          <FadeInItem style={styles.hero}>
            <AppText variant="display" style={{ fontSize: 52, lineHeight: 58, letterSpacing: -2 }} testID="ring-used">
              {snap.measured ? formatDuration(snap.totals.usedMs) : '—'}
            </AppText>
            <AppText variant="small" tone="muted">
              {snap.measured ? `de ${formatHoursMinutes(snap.totals.limitMs)} permitidos hoje` : 'utilização de hoje'}
            </AppText>
            {snap.measured ? <AppProgressBar progress={snap.totals.ratio} height={3} style={{ marginTop: spacing.lg }} accessibilityLabel="Tempo usado hoje" /> : null}
          </FadeInItem>

          {!snap.measured ? (
            <AppCard style={{ marginTop: spacing.xl }} testID="usage-unavailable">
              <AppText variant="bodyStrong">Dados de utilização indisponíveis</AppText>
              <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
                {snap.capabilities.platform === 'web'
                  ? 'Na versão web não é possível medir o tempo nas aplicações. Utilize o aplicativo Android ou iOS.'
                  : snap.capabilities.platform === 'ios'
                    ? 'No iOS a Apple não disponibiliza os minutos de cada aplicação ao offly. Os limites são aplicados pelo Tempo de Ecrã.'
                    : 'Conceda o acesso aos dados de utilização para ver o seu tempo real. Não mostramos valores estimados.'}
              </AppText>
              {snap.capabilities.platform === 'android' ? (
                <AppButton label="Configurar" size="sm" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => router.push('/settings/permissions')} />
              ) : null}
            </AppCard>
          ) : null}

          <View style={styles.sectionHead}>
            <AppText variant="overline" tone="muted">
              APLICAÇÕES
            </AppText>
            <Pressable onPress={() => router.push('/settings/limits')} accessibilityRole="button" hitSlop={8} testID="manage-apps">
              <AppText variant="caption" tone="muted">
                {apps.length > MAX_APPS ? `Ver todas (${apps.length})` : 'Gerir'}
              </AppText>
            </Pressable>
          </View>
          <View style={{ gap: spacing.xs }}>
            {apps.slice(0, MAX_APPS).map((a) => (
              <AppUsageCard
                key={a.appId}
                appId={a.appId}
                name={a.name}
                usedMin={snap.measured ? Math.floor(a.usedMs / MINUTE) : null}
                limitMin={a.limitMinutes}
                state={a.state}
                onPress={() => openApp(a.appId, a.state)}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        {challenge ? (
          <ListRow
            icon={{ set: 'feather', name: 'award' }}
            title={challenge.label}
            subtitle={`Dia ${challenge.stats.dayNumber} de ${challenge.stats.total}`}
            chevron
            onPress={() => router.push('/challenge')}
            testID="challenge-card"
          />
        ) : null}
        <ListRow
          icon={{ set: 'feather', name: 'check-square' }}
          title="Hábitos"
          subtitle={habitToday && habitToday.due > 0 ? `${habitToday.done} de ${habitToday.due} hoje` : 'Criar o primeiro hábito'}
          chevron
          onPress={() => router.push('/habits')}
        />
      </View>

      <Pressable onPress={() => router.push('/help-now')} accessibilityRole="button" style={styles.help} hitSlop={8}>
        <Feather name="life-buoy" size={14} color={colors.textMuted} />
        <AppText variant="caption" tone="muted">
          Preciso de ajuda agora
        </AppText>
      </Pressable>

      <LimitEditorSheet limit={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  hero: { marginTop: spacing.xxl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.sm },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl, paddingVertical: spacing.sm },
});
