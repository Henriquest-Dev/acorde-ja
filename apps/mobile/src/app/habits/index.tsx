import { WEEK_INITIALS, dayKey, describeFrequency, isDoneOn, isDueOn, weeklyProgress } from '@acorde/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppEmptyState,
  AppHabitCard,
  AppHeader,
  AppSkeleton,
  AppText,
  HeaderIconButton,
  RowIconView,
  Screen,
  SegmentedControl,
} from '@/components';
import { habitIcon } from '@/features/habits/icons';
import { useToggleHabit } from '@/features/habits/useToggleHabit';
import { useHabitsWeek } from '@/hooks/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Hábitos — actividades alternativas. */
export default function Habits() {
  const { colors } = useTheme();
  const now = new Date();
  const today = dayKey(now);
  const [tab, setTab] = useState<'all' | 'today' | 'week'>('all');
  const { data, isLoading } = useHabitsWeek(now);
  const toggle = useToggleHabit();
  const habits = data?.habits ?? [];
  const entries = data?.entries ?? [];
  const visible = tab === 'today' ? habits.filter((h) => isDueOn(h, now)) : habits;

  return (
    <Screen testID="habits">
      <AppHeader
        title="Os seus hábitos"
        right={<HeaderIconButton icon="plus" label="Criar hábito" onPress={() => router.push('/habits/new')} />}
      />
      <SegmentedControl
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'today', label: 'Hoje' },
          { value: 'week', label: 'Semana' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {isLoading ? (
          [0, 1, 2].map((i) => <AppSkeleton key={i} height={54} radius={12} />)
        ) : visible.length === 0 ? (
          <AppEmptyState
            icon="check-square"
            title={tab === 'today' ? 'Nada para hoje' : 'Ainda sem hábitos'}
            message="Crie pequenas rotinas que o afastem do ecrã: ler, caminhar, dormir mais cedo."
            actionLabel="Criar hábito"
            onAction={() => router.push('/habits/new')}
          />
        ) : tab === 'week' ? (
          visible.map((h) => {
            const p = weeklyProgress(h, entries, now);
            return (
              <Pressable
                key={h.id}
                onPress={() => router.push({ pathname: '/habits/[id]', params: { id: h.id } })}
                style={[styles.weekRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityLabel={`${h.title}: ${p.done} de ${p.expected} esta semana`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <RowIconView icon={habitIcon(h.icon)} />
                  <AppText variant="small" weight="medium" style={{ flex: 1 }}>
                    {h.title}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {p.done}/{p.expected}
                  </AppText>
                </View>
                <View style={styles.days}>
                  {p.days.map((d, i) => {
                    const done = isDoneOn(h.id, d, entries);
                    return (
                      <Pressable
                        key={d}
                        disabled={d > today}
                        onPress={() => void toggle(entries, h.id, d)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                        accessibilityLabel={`${h.title} ${d}`}
                        style={[styles.day, { borderColor: d === today ? colors.text : colors.border, backgroundColor: done ? colors.accent : 'transparent', opacity: d > today ? 0.3 : 1 }]}
                      >
                        <AppText variant="caption" style={{ fontSize: 10, color: done ? colors.onAccent : colors.textMuted }}>
                          {WEEK_INITIALS[i]}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </Pressable>
            );
          })
        ) : (
          visible.map((h) => (
            <AppHabitCard
              key={h.id}
              icon={habitIcon(h.icon)}
              title={h.title}
              subtitle={tab === 'today' ? undefined : describeFrequency(h.frequency)}
              done={isDoneOn(h.id, today, entries)}
              onToggle={() => void toggle(entries, h.id, today)}
              onPress={() => router.push({ pathname: '/habits/[id]', params: { id: h.id } })}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekRow: { padding: spacing.lg, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
