import { blockScheduleSchema } from '@acorde/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton, AppCheckbox, AppHeader, AppSlider, AppSwitch, AppText, BrandIcon, Screen, SectionTitle, toast } from '@/components';
import { qk, useInvalidate, useLimits, useSchedules } from '@/hooks/queries';
import { NIGHT_SCHEDULE_ID, upsertSchedule, type LabeledSchedule } from '@/repositories/limits';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const toSlot = (t: string) => Number(t.slice(0, 2)) * 2 + (t.endsWith('30') ? 1 : 0);
const fromSlot = (v: number) => `${String(Math.floor(v / 2) % 24).padStart(2, '0')}:${v % 2 ? '30' : '00'}`;

/** Horários de bloqueio (ex.: 22:00–07:00 todas as noites). */
export default function Schedules() {
  const { colors } = useTheme();
  const { data: schedules } = useSchedules();
  const { data: limits } = useLimits();
  const strict = usePrefs((s) => s.prefs.rules.strictMode);
  const invalidate = useInvalidate();
  const [edited, setDraft] = useState<LabeledSchedule | null>(null);
  // O rascunho parte do horário guardado até o utilizador o alterar.
  const draft = edited ?? schedules?.find((s) => s.id === NIGHT_SCHEDULE_ID) ?? null;

  if (!draft) return <Screen><AppHeader title="Horários de bloqueio" back /></Screen>;

  const save = async () => {
    const parsed = blockScheduleSchema.safeParse(draft);
    if (!parsed.success) return toast(parsed.error.issues[0]?.message ?? 'Horário inválido', 'error');
    await upsertSchedule(draft);
    await syncRulesToNative();
    await invalidate(qk.schedules, qk.today);
    toast('Horário guardado.');
  };

  const locked = strict && draft.enabled;

  return (
    <Screen footer={<AppButton label="Guardar" onPress={save} disabled={locked} />}>
      <AppHeader title="Horários de bloqueio" back />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">
            {draft.start} - {draft.end}
          </AppText>
          <AppText variant="caption" tone="muted">
            As aplicações escolhidas ficam bloqueadas neste horário.
          </AppText>
        </View>
        <AppSwitch value={draft.enabled} onValueChange={(v) => setDraft({ ...draft, enabled: v })} disabled={locked} accessibilityLabel="Horário activo" />
      </View>
      {locked ? (
        <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.md }}>
          O modo restrito está activo: o horário não pode ser alterado.
        </AppText>
      ) : null}

      <SectionTitle>Início</SectionTitle>
      <AppSlider value={toSlot(draft.start)} min={0} max={47} onChange={(v) => setDraft({ ...draft, start: fromSlot(v) })} accessibilityLabel="Hora de início" formatValue={fromSlot} />
      <SectionTitle>Fim</SectionTitle>
      <AppSlider value={toSlot(draft.end)} min={0} max={47} onChange={(v) => setDraft({ ...draft, end: fromSlot(v) })} accessibilityLabel="Hora de fim" formatValue={fromSlot} />

      <SectionTitle>Dias</SectionTitle>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {DAYS.map((d, i) => {
          const on = draft.days.includes(i);
          return (
            <Pressable
              key={d}
              onPress={() => setDraft({ ...draft, days: on ? draft.days.filter((x) => x !== i) : [...draft.days, i].sort() })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={d}
              style={[styles.day, { borderColor: colors.border, backgroundColor: on ? colors.accent : 'transparent' }]}
            >
              <AppText variant="caption" style={{ color: on ? colors.onAccent : colors.text }}>
                {d}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Aplicações</SectionTitle>
      <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
        Sem selecção, o horário aplica-se a todas as aplicações com limite.
      </AppText>
      <View style={{ gap: spacing.md }}>
        {(limits ?? []).map((l) => (
          <View key={l.appId} style={styles.row}>
            <BrandIcon appId={l.appId} name={l.name} size={26} />
            <AppText variant="small" style={{ flex: 1 }}>
              {l.name}
            </AppText>
            <AppCheckbox
              checked={draft.appIds.includes(l.appId)}
              onChange={(v) => setDraft({ ...draft, appIds: v ? [...draft.appIds, l.appId] : draft.appIds.filter((x) => x !== l.appId) })}
              accessibilityLabel={l.name}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  day: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
