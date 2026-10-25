import { HABIT_SUGGESTIONS, addDays, dayKey, habitFormSchema, isDoneOn, type HabitForm } from '@acorde/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton, AppHeader, AppInput, AppSlider, AppSwitch, AppText, RowIconView, Screen, SectionTitle, SegmentedControl, toast } from '@/components';
import { HABIT_ICONS } from '@/features/habits/icons';
import { qk, useInvalidate } from '@/hooks/queries';
import { deleteHabit, entriesBetween, getHabit, listHabits, saveHabit } from '@/repositories/habits';
import { cancelNotification, scheduleHabitReminders } from '@/services/notifications';
import { enqueueSync } from '@/services/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const DAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Criar / editar hábito, com calendário e evolução das últimas 4 semanas. */
export default function HabitEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [saving, setSaving] = useState(false);
  const habit = useQuery({ queryKey: ['habit', id], queryFn: () => getHabit(id!), enabled: !isNew });
  const since = addDays(new Date(), -27);
  const history = useQuery({ queryKey: ['habit-history', id], queryFn: () => entriesBetween(dayKey(since), dayKey(new Date())), enabled: !isNew });

  const { control, handleSubmit, reset, watch, setValue, formState } = useForm<HabitForm>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: { title: '', icon: 'book-open', target: null, frequency: { kind: 'daily' }, reminderTime: null },
  });

  useEffect(() => {
    const h = habit.data;
    if (h) reset({ title: h.title, icon: h.icon, target: h.target, frequency: h.frequency, reminderTime: h.reminderTime });
  }, [habit.data, reset]);

  const frequency = watch('frequency');
  const reminder = watch('reminderTime');
  const icon = watch('icon');

  const onSubmit = handleSubmit(async (form) => {
    setSaving(true);
    try {
      const existing = habit.data;
      for (const n of existing?.reminderIds ?? []) await cancelNotification(n);
      const base = {
        id: existing?.id ?? randomUUID(),
        ...form,
        archivedAt: existing?.archivedAt ?? null,
        createdAt: existing?.createdAt ?? Date.now(),
        sort: existing?.sort ?? (await listHabits(true)).length,
        reminderIds: [] as string[],
      };
      base.reminderIds = await scheduleHabitReminders(base);
      await saveHabit(base);
      await enqueueSync('habits', 'upsert', base.id, {
        id: base.id,
        title: base.title,
        icon: base.icon,
        frequency: base.frequency,
        target: base.target,
        reminder_time: base.reminderTime,
        archived_at: null,
        updated_at: new Date().toISOString(),
      });
      await invalidate(qk.habits, ['habit', base.id]);
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível guardar', 'error');
    } finally {
      setSaving(false);
    }
  });

  const archive = async () => {
    const h = habit.data;
    if (!h) return;
    for (const n of h.reminderIds) await cancelNotification(n);
    await saveHabit({ ...h, archivedAt: Date.now(), reminderIds: [] });
    await enqueueSync('habits', 'upsert', h.id, { id: h.id, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await invalidate(qk.habits);
    toast('Hábito arquivado.');
    router.back();
  };

  const remove = async () => {
    const h = habit.data;
    if (!h) return;
    for (const n of h.reminderIds) await cancelNotification(n);
    await deleteHabit(h.id);
    await enqueueSync('habits', 'delete', h.id, {});
    await invalidate(qk.habits);
    router.back();
  };

  const days = Array.from({ length: 28 }, (_, i) => dayKey(addDays(since, i)));
  const doneCount = history.data ? days.filter((d) => isDoneOn(id!, d, history.data!)).length : 0;

  return (
    <Screen footer={<AppButton label={isNew ? 'Criar hábito' : 'Guardar'} onPress={onSubmit} loading={saving} testID="habit-save" />}>
      <AppHeader title={isNew ? 'Novo hábito' : 'Editar hábito'} back />

      {isNew ? (
        <View style={styles.suggestions}>
          {HABIT_SUGGESTIONS.map((s) => (
            <Pressable
              key={s.title}
              onPress={() => {
                setValue('title', s.title);
                setValue('icon', s.icon in HABIT_ICONS ? s.icon : 'book-open');
                setValue('target', s.target);
              }}
              style={[styles.chip, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <AppText variant="caption">{s.title}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="title"
          render={({ field }) => <AppInput label="Nome" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.title?.message} placeholder="Ex.: Ler 20 minutos" />}
        />
        <Controller
          control={control}
          name="target"
          render={({ field }) => (
            <AppInput label="Objectivo (opcional)" value={field.value ?? ''} onChangeText={(t) => field.onChange(t || null)} placeholder="Ex.: 20 minutos" error={formState.errors.target?.message} />
          )}
        />
      </View>

      <SectionTitle>Ícone</SectionTitle>
      <View style={styles.icons}>
        {Object.entries(HABIT_ICONS).map(([key, ic]) => (
          <Pressable
            key={key}
            onPress={() => setValue('icon', key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: icon === key }}
            accessibilityLabel={key}
            style={[styles.iconBtn, { borderColor: icon === key ? colors.text : colors.border, backgroundColor: icon === key ? colors.elevated : 'transparent' }]}
          >
            <RowIconView icon={ic} />
          </Pressable>
        ))}
      </View>

      <SectionTitle>Frequência</SectionTitle>
      <SegmentedControl
        options={[
          { value: 'daily', label: 'Diário' },
          { value: 'weekdays', label: 'Dias' },
          { value: 'times_per_week', label: 'Vezes/sem.' },
        ]}
        value={frequency.kind}
        onChange={(k) =>
          setValue('frequency', k === 'daily' ? { kind: 'daily' } : k === 'weekdays' ? { kind: 'weekdays', days: [1, 3, 5] } : { kind: 'times_per_week', times: 3 })
        }
      />
      {frequency.kind === 'weekdays' ? (
        <View style={[styles.icons, { marginTop: spacing.md }]}>
          {DAY_NAMES.map((n, d) => {
            const on = frequency.days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => setValue('frequency', { kind: 'weekdays', days: on ? frequency.days.filter((x) => x !== d) : [...frequency.days, d].sort() })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.dayBtn, { borderColor: colors.border, backgroundColor: on ? colors.accent : 'transparent' }]}
              >
                <AppText variant="small" style={{ color: on ? colors.onAccent : colors.text }}>
                  {n}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {frequency.kind === 'times_per_week' ? (
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="small" tone="secondary">
            {frequency.times}× por semana
          </AppText>
          <AppSlider value={frequency.times} min={1} max={7} onChange={(t) => setValue('frequency', { kind: 'times_per_week', times: t })} accessibilityLabel="Vezes por semana" />
        </View>
      ) : null}
      {formState.errors.frequency ? (
        <AppText variant="caption" tone="secondary">
          {'days' in formState.errors.frequency ? (formState.errors.frequency as { days?: { message?: string } }).days?.message : 'Frequência inválida'}
        </AppText>
      ) : null}

      <SectionTitle>Lembrete</SectionTitle>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <AppText variant="small" style={{ flex: 1 }}>
          {reminder ? `Todos os dias previstos às ${reminder}` : 'Sem lembrete'}
        </AppText>
        <AppSwitch value={reminder !== null} onValueChange={(v) => setValue('reminderTime', v ? '21:00' : null)} accessibilityLabel="Lembrete" />
      </View>
      {reminder ? (
        <AppSlider
          value={Number(reminder.split(':')[0]) * 2 + (reminder.endsWith('30') ? 1 : 0)}
          min={10}
          max={46}
          onChange={(v) => setValue('reminderTime', `${String(Math.floor(v / 2)).padStart(2, '0')}:${v % 2 ? '30' : '00'}`)}
          accessibilityLabel="Hora do lembrete"
          formatValue={(v) => `${Math.floor(v / 2)}:${v % 2 ? '30' : '00'}`}
        />
      ) : null}

      {!isNew ? (
        <>
          <SectionTitle>Últimas 4 semanas</SectionTitle>
          <AppText variant="small" tone="muted" style={{ marginBottom: spacing.md }}>
            Concluído em {doneCount} de 28 dias
          </AppText>
          <View style={styles.calendar}>
            {days.map((d) => {
              const done = history.data ? isDoneOn(id!, d, history.data) : false;
              return <View key={d} accessibilityLabel={`${d}: ${done ? 'concluído' : 'não concluído'}`} style={[styles.cell, { backgroundColor: done ? colors.accent : colors.track }]} />;
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl }}>
            <AppButton label="Arquivar" variant="secondary" size="sm" style={{ flex: 1 }} onPress={archive} />
            <AppButton label="Eliminar" variant="ghost" size="sm" style={{ flex: 1 }} onPress={remove} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 34, height: 34, borderRadius: 6 },
});
