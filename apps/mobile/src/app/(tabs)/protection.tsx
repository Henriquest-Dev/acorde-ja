import { challengeEndsAt, formatDayMonth, type ShieldConfig } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader, AppSwitch, AppText, FadeInItem, ListRow, PressableScale, Screen, SectionTitle, toast } from '@/components';
import { MindfulPause } from '@/components/MindfulPause';
import { qk, useActiveChallenges, useInvalidate, useLimits, useSchedules } from '@/hooks/queries';
import { GOAL_CATEGORY } from '@/services/challenge';
import { sayMoment } from '@/services/coach';
import { getCapabilities, shield } from '@/native/device';
import { NIGHT_SCHEDULE_ID, upsertSchedule } from '@/repositories/limits';
import { applyShield } from '@/services/shield';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Proteção — apps com limite, sites bloqueados e modo restrito. Só o essencial. */
export default function Protection() {
  const { colors } = useTheme();
  const { prefs, update } = usePrefs();
  const { data: schedules } = useSchedules();
  const { data: limits } = useLimits();
  const invalidate = useInvalidate();
  const [confirmStrictOff, setConfirmStrictOff] = useState(false);
  const status = useQuery({
    queryKey: ['shield-status'],
    queryFn: async () => ({
      caps: await getCapabilities(),
      stats: await shield.stats(),
    }),
  });
  const night = schedules?.find((s) => s.id === NIGHT_SCHEDULE_ID);

  const challenges = useActiveChallenges();
  const lockedCategories = (challenges.data ?? []).map((c) => GOAL_CATEGORY[c.challenge.goal]);
  const lockedUntil = Math.max(0, ...(challenges.data ?? []).map((c) => challengeEndsAt(c.challenge)));
  const lockMessage = `Desafio em curso: a protecção está trancada até ${formatDayMonth(new Date(lockedUntil - 1))}.`;

  const setShield = async (patch: Partial<ShieldConfig>) => {
    const next = {
      ...prefs.shield,
      ...patch,
      categories: { ...prefs.shield.categories, ...patch.categories },
    };
    await update({ shield: next });
    const res = await applyShield(next);
    if (res.status === 'unsupported') toast(res.reason, 'error');
    else if (res.status === 'permission_denied')
      toast('A ligação VPN local não foi autorizada. A protecção de sites está desligada.', 'error');
    else if (res.status === 'active') toast(`Protecção activa (${res.domains} domínios).`);
    void status.refetch();
  };

  const setStrict = async (on: boolean) => {
    await update((p) => ({
      rules: { ...p.rules, strictMode: on },
      shield: { ...p.shield, strictMode: on },
    }));
    await syncRulesToNative();
    await invalidate(qk.today);
  };

  const toggleNight = async (enabled: boolean) => {
    if (!night) return;
    if (!enabled && prefs.rules.strictMode) {
      toast('Desligue primeiro o modo restrito para alterar o horário.', 'error');
      return;
    }
    await upsertSchedule({ ...night, enabled });
    await syncRulesToNative();
    await invalidate(qk.schedules, qk.today);
  };

  const shieldRunning = status.data?.stats?.running ?? false;

  return (
    <Screen testID="protection">
      <AppHeader title="Proteção" back onBack={() => router.navigate('/')} />
      {lockedUntil > 0 ? (
        <FadeInItem index={0}>
          <PressableScale
            onPress={() => router.push('/challenge')}
            accessibilityRole="button"
            style={[styles.lock, { borderColor: colors.text, backgroundColor: colors.card }]}
          >
            <Feather name="lock" size={18} color={colors.text} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Protecção trancada pelo desafio</AppText>
              <AppText variant="caption" tone="muted">
                Até {formatDayMonth(new Date(lockedUntil - 1))} · ver calendário
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
        </FadeInItem>
      ) : null}
      <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name={shieldRunning ? 'shield' : 'shield-off'} size={18} color={colors.text} />
        <AppText variant="small" style={{ flex: 1 }}>
          {shieldRunning ? `Proteção ligada · ${status.data?.stats?.blockedToday ?? 0} bloqueios hoje` : 'Proteção de sites desligada'}
        </AppText>
      </View>

      <SectionTitle>Apps</SectionTitle>
      <ListRow
        icon={{ set: 'mci', name: 'timer-sand' }}
        title="Apps que me distraem"
        subtitle={`${(limits ?? []).filter((l) => l.enabled).length} com limite · adicionar ou mudar o tempo`}
        chevron
        onPress={() => router.push('/settings/limits')}
        testID="protection-apps"
      />

      <SectionTitle>Sites</SectionTitle>
      <View style={{ gap: spacing.md }}>
        <ListRow
          icon={{ set: 'mci', name: 'close-octagon-outline' }}
          title="Bloquear sites adultos"
          right={
            <AppSwitch
              value={prefs.shield.categories.adult}
              onValueChange={(v) => {
                if (!v && lockedCategories.includes('adult')) {
                  sayMoment('giveUp');
                  return toast(lockMessage, 'error');
                }
                if (!v && prefs.shield.strictMode) return toast('O modo restrito impede desligar esta protecção.', 'error');
                void setShield({
                  categories: { ...prefs.shield.categories, adult: v },
                });
              }}
              accessibilityLabel="Bloquear sites adultos"
              testID="toggle-adult"
            />
          }
        />
        <ListRow
          icon={{ set: 'mci', name: 'cards-playing-outline' }}
          title="Bloquear sites de apostas"
          right={
            <AppSwitch
              value={prefs.shield.categories.gambling}
              onValueChange={(v) => {
                if (!v && lockedCategories.includes('gambling')) {
                  sayMoment('giveUp');
                  return toast(lockMessage, 'error');
                }
                if (!v && prefs.shield.strictMode) return toast('O modo restrito impede desligar esta protecção.', 'error');
                void setShield({
                  categories: { ...prefs.shield.categories, gambling: v },
                });
              }}
              accessibilityLabel="Bloquear sites de apostas"
              testID="toggle-gambling"
            />
          }
        />
      </View>

      <SectionTitle>Mais força</SectionTitle>
      <View style={{ gap: spacing.md }}>
        <ListRow
          icon={{ set: 'mci', name: 'timer-lock-outline' }}
          title="Modo restrito"
          subtitle="Não deixa desligar a proteção num impulso"
          right={
            <AppSwitch
              value={prefs.rules.strictMode}
              onValueChange={(v) => (v ? void setStrict(true) : setConfirmStrictOff(true))}
              accessibilityLabel="Modo restrito"
              testID="toggle-strict"
            />
          }
        />
        <ListRow
          icon={{ set: 'mci', name: 'clock-outline' }}
          title="Horário de bloqueio"
          subtitle={night ? `${night.start} - ${night.end}` : '22:00 - 07:00'}
          onPress={() => router.push('/settings/schedules')}
          right={
            <AppSwitch
              value={night?.enabled ?? false}
              onValueChange={toggleNight}
              accessibilityLabel="Horário de bloqueio"
              testID="toggle-night"
            />
          }
        />
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <ListRow
          icon={{ set: 'feather', name: 'life-buoy' }}
          title="Preciso de ajuda agora"
          subtitle="Linhas de apoio do teu país"
          chevron
          onPress={() => router.push('/help-now')}
        />
      </View>

      <MindfulPause
        visible={confirmStrictOff}
        title="Desligar o modo restrito?"
        message="O modo restrito existe para os momentos difíceis. Respire fundo durante 30 segundos antes de decidir."
        confirmLabel="Desligar modo restrito"
        onClose={() => setConfirmStrictOff(false)}
        onConfirm={() => {
          setConfirmStrictOff(false);
          void setStrict(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
});
