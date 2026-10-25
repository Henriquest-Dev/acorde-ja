import {
  WEEK_INITIALS,
  addDays,
  formatDayMonth,
  formatDuration,
  formatMonthYear,
  parseDayKey,
  periodRange,
  withOthers,
  type ReportPeriod,
} from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppBarChart,
  AppButton,
  AppCard,
  AppEmptyState,
  AppErrorState,
  AppSkeleton,
  AppText,
  BrandIcon,
  ListRow,
  Screen,
  SectionTitle,
  SegmentedControl,
  toast,
} from '@/components';
import { exportCsv, exportPdf } from '@/features/insights/export';
import { useReport } from '@/hooks/queries';
import { usageBetween } from '@/repositories/usage';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const PREV_LABEL: Record<ReportPeriod, string> = { day: 'a ontem', week: 'à semana passada', month: 'ao mês passado' };

/** Relatórios — estatísticas e evolução (dados reais). */
export default function Progress() {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<ReportPeriod>('day');
  const [ref, setRef] = useState(new Date());
  const report = useReport(period, ref);
  const chartPeriod: ReportPeriod = period === 'month' ? 'month' : 'week';
  const chart = useReport(chartPeriod, ref);

  const shift = (dir: -1 | 1) => {
    const next = period === 'day' ? addDays(ref, dir) : period === 'week' ? addDays(ref, dir * 7) : new Date(ref.getFullYear(), ref.getMonth() + dir, 1);
    if (next.getTime() > Date.now()) return;
    setRef(next);
  };

  const range = periodRange(period, ref);
  const title =
    period === 'day'
      ? formatDayMonth(ref)
      : period === 'week'
        ? `${formatDayMonth(range.start)} – ${formatDayMonth(addDays(range.end, -1))}`
        : formatMonthYear(ref);

  const data = report.data;
  const total = data ? (data.screen.hasData ? data.screen.totalMs : data.report.totalMs) : 0;
  const list = data ? withOthers(data.report.byApp, data.tracked) : [];
  const bars =
    chart.data?.screen.byDay.map((d, i) => {
      const date = parseDayKey(d.day);
      const label = chartPeriod === 'week' ? WEEK_INITIALS[i]! : date.getDate() % 5 === 1 ? String(date.getDate()) : '';
      return { key: d.day, label, value: d.totalMs, valueLabel: formatDuration(d.totalMs) };
    }) ?? [];

  const doExport = async (kind: 'csv' | 'pdf') => {
    try {
      const rows = await usageBetween(range.days[0]!, range.days[range.days.length - 1]!);
      if (rows.length === 0) return toast('Não há dados neste período para exportar.', 'error');
      if (kind === 'csv') await exportCsv(rows, range.days[0]!);
      else
        await exportPdf({
          title,
          totalMs: total,
          byApp: list,
          focusMs: data?.focusMs ?? 0,
          exceptions: data?.exceptions.length ?? 0,
        });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha ao exportar', 'error');
    }
  };

  return (
    <Screen refreshing={report.isRefetching} onRefresh={() => void report.refetch()} testID="reports">
      <SegmentedControl
        options={[
          { value: 'day', label: 'Dia' },
          { value: 'week', label: 'Semana' },
          { value: 'month', label: 'Mês' },
        ]}
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setRef(new Date());
        }}
      />
      <View style={styles.nav}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Período anterior" hitSlop={12}>
          <Feather name="chevron-left" size={18} color={colors.textMuted} />
        </Pressable>
        <AppText variant="small" tone="secondary">
          {title}
        </AppText>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Período seguinte" hitSlop={12}>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {report.isLoading ? (
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <AppSkeleton width={160} height={40} style={{ alignSelf: 'center' }} />
          <AppSkeleton height={140} />
        </View>
      ) : report.isError ? (
        <AppErrorState message="Não foi possível carregar o relatório." onRetry={() => void report.refetch()} />
      ) : !data?.report.hasData && !data?.screen.hasData ? (
        <AppEmptyState
          icon="bar-chart-2"
          title="Sem dados neste período"
          message="Os relatórios usam apenas a utilização real medida pelo sistema. Conceda o acesso aos dados de utilização para começar."
          actionLabel="Verificar permissões"
          onAction={() => router.push('/settings/permissions')}
        />
      ) : (
        <>
          <AppText variant="display" align="center" style={{ marginTop: spacing.lg, fontSize: 36 }} testID="report-total">
            {formatDuration(total)}
          </AppText>
          {data.change !== null ? (
            <AppText variant="small" tone="muted" align="center">
              {data.change <= 0 ? '↓' : '↑'} {Math.abs(data.change)}% em relação {PREV_LABEL[period]}
            </AppText>
          ) : (
            <AppText variant="small" tone="muted" align="center">
              Sem dados do período anterior para comparar
            </AppText>
          )}
          <View style={{ marginTop: spacing.lg }}>
            <AppBarChart data={bars} height={110} testID="report-chart" />
          </View>
          <View style={{ marginTop: spacing.xl, gap: 2 }}>
            {list.map((a) => (
              <View key={a.appId} style={styles.appRow}>
                {a.appId === '__others__' ? (
                  <View style={[styles.others, { borderColor: colors.textMuted }]}>
                    <Feather name="grid" size={11} color={colors.textMuted} />
                  </View>
                ) : (
                  <BrandIcon appId={a.appId} name={a.appName} size={20} />
                )}
                <AppText variant="small" style={{ flex: 1 }}>
                  {a.appName}
                </AppText>
                <AppText variant="small" tone="secondary">
                  {formatDuration(a.usedMs)}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.metrics}>
            <Metric label="Tempo excedido" value={formatDuration(data.report.exceededMs)} />
            <Metric label="Foco" value={`${formatDuration(data.focusMs)} · ${data.focusCount}`} />
            <Metric label="Excepções" value={String(data.exceptions.length)} />
          </View>

          <SectionTitle>Exportar</SectionTitle>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <AppButton label="CSV" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => void doExport('csv')} />
            <AppButton label="PDF" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => void doExport('pdf')} />
          </View>
        </>
      )}

      <SectionTitle>Mais</SectionTitle>
      <View style={{ gap: spacing.md }}>
        <ListRow icon={{ set: 'feather', name: 'check-square' }} title="Os seus hábitos" chevron onPress={() => router.push('/habits')} />
        <ListRow icon={{ set: 'feather', name: 'users' }} title="Família" chevron onPress={() => router.push('/family')} />
      </View>
      <AppCard style={{ marginTop: spacing.lg }}>
        <AppText variant="caption" tone="muted">
          A frequência de abertura e o tempo por aplicação vêm do Android (UsageStatsManager). No iOS, os relatórios detalhados só podem
          ser vistos no Tempo de Ecrã do sistema.
        </AppText>
      </AppCard>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="small" weight="semibold">
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, paddingHorizontal: spacing.xs },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 34 },
  others: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', marginTop: spacing.xl },
});
