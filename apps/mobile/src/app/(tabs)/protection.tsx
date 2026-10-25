import { challengeEndsAt, formatDayMonth, type ShieldConfig } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppCard, AppHeader, AppSwitch, AppText, FadeInItem, ListRow, PressableScale, Screen, SectionTitle, toast } from '@/components';
import { MindfulPause } from '@/components/MindfulPause';
import { qk, useActiveChallenges, useInvalidate, useSchedules } from '@/hooks/queries';
import { GOAL_CATEGORY } from '@/services/challenge';
import { getCapabilities, openSystemSettings, shield } from '@/native/device';
import { NIGHT_SCHEDULE_ID, upsertSchedule } from '@/repositories/limits';
import { applyShield } from '@/services/shield';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Proteção — sites e conteúdos (Digital Shield) e modo restrito. */
export default function Protection() {
  const { colors } = useTheme();
  const { prefs, update } = usePrefs();
  const { data: schedules } = useSchedules();
  const invalidate = useInvalidate();
  const [confirmStrictOff, setConfirmStrictOff] = useState(false);
  const status = useQuery({
    queryKey: ['shield-status'],
    queryFn: async () => ({ caps: await getCapabilities(), stats: await shield.stats() }),
  });
  const night = schedules?.find((s) => s.id === NIGHT_SCHEDULE_ID);

  const challenges = useActiveChallenges();
  const lockedCategories = (challenges.data ?? []).map((c) => GOAL_CATEGORY[c.challenge.goal]);
  const lockedUntil = Math.max(0, ...(challenges.data ?? []).map((c) => challengeEndsAt(c.challenge)));
  const lockMessage = `Desafio em curso: a protecção está trancada até ${formatDayMonth(new Date(lockedUntil - 1))}.`;

  const setShield = async (patch: Partial<ShieldConfig>) => {
    const next = { ...prefs.shield, ...patch, categories: { ...prefs.shield.categories, ...patch.categories } };
    await update({ shield: next });
    const res = await applyShield(next);
    if (res.status === 'unsupported') toast(res.reason, 'error');
    else if (res.status === 'permission_denied') toast('A ligação VPN local não foi autorizada. A protecção de sites está desligada.', 'error');
    else if (res.status === 'active') toast(`Protecção activa (${res.domains} domínios).`);
    void status.refetch();
  };

  const setStrict = async (on: boolean) => {
    await update((p) => ({ rules: { ...p.rules, strictMode: on }, shield: { ...p.shield, strictMode: on } }));
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
          <PressableScale onPress={() => router.push('/challenge')} accessibilityRole="button" style={[styles.lock, { borderColor: colors.text, backgroundColor: colors.card }]}>
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
      <View style={{ gap: spacing.md }}>
        <ListRow
          icon={{ set: 'mci', name: 'close-octagon-outline' }}
          title="Bloquear sites adultos"
          right={
            <AppSwitch
              value={prefs.shield.categories.adult}
              onValueChange={(v) => {
                if (!v && lockedCategories.includes('adult')) return toast(lockMessage, 'error');
                if (!v && prefs.shield.strictMode) return toast('O modo restrito impede desligar esta protecção.', 'error');
                void setShield({ categories: { ...prefs.shield.categories, adult: v } });
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
                if (!v && lockedCategories.includes('gambling')) return toast(lockMessage, 'error');
                if (!v && prefs.shield.strictMode) return toast('O modo restrito impede desligar esta protecção.', 'error');
                void setShield({ categories: { ...prefs.shield.categories, gambling: v } });
              }}
              accessibilityLabel="Bloquear sites de apostas"
              testID="toggle-gambling"
            />
          }
        />
        <ListRow icon={{ set: 'mci', name: 'tag-outline' }} title="Bloquear por categoria" chevron onPress={() => router.push('/shield/categories')} />
        <ListRow icon={{ set: 'mci', name: 'format-list-checks' }} title="Lista personalizada" chevron onPress={() => router.push('/shield/custom')} />
        <ListRow
          icon={{ set: 'mci', name: 'timer-lock-outline' }}
          title="Modo restrito"
          subtitle="Mais proteção"
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
          right={<AppSwitch value={night?.enabled ?? false} onValueChange={toggleNight} accessibilityLabel="Horário de bloqueio" testID="toggle-night" />}
        />
      </View>

      <SectionTitle>Diagnóstico</SectionTitle>
      <AppCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Feather name={shieldRunning ? 'shield' : 'shield-off'} size={20} color={colors.text} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{shieldRunning ? 'Filtro de sites activo' : 'Filtro de sites desligado'}</AppText>
            <AppText variant="caption" tone="muted">
              {status.data?.caps.canBlockSites === false
                ? 'Indisponível neste dispositivo.'
                : shieldRunning
                  ? `${status.data?.stats?.blockedToday ?? 0} tentativas bloqueadas hoje · ${status.data?.stats?.domains ?? 0} domínios`
                  : 'Active uma categoria ou adicione domínios à lista.'}
            </AppText>
            {status.data?.stats?.lastError ? (
              <AppText variant="caption" tone="secondary">
                Último erro: {status.data.stats.lastError}
              </AppText>
            ) : null}
          </View>
        </View>
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
          Limitações: navegadores com «DNS seguro» activo, o «DNS privado» do Android em modo manual e outras VPNs podem contornar o
          filtro. Para maior protecção, active a «VPN sempre activa» nas definições do sistema.
        </AppText>
        {status.data?.caps.platform === 'android' ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md }}>
            <AppText variant="small" style={{ textDecorationLine: 'underline' }} onPress={() => void openSystemSettings('vpn')}>
              VPN sempre activa
            </AppText>
            <AppText variant="small" style={{ textDecorationLine: 'underline' }} onPress={() => void openSystemSettings('private_dns')}>
              DNS privado
            </AppText>
          </View>
        ) : null}
      </AppCard>

      {prefs.shield.categories.gambling || prefs.goals.includes('avoid_gambling') ? (
        <>
          <SectionTitle>Apoio para quem quer deixar de apostar</SectionTitle>
          <AppCard>
            <AppText variant="small" tone="secondary">
              Em Portugal pode pedir a autoexclusão de todos os sites de jogo legais junto do SRIJ (Serviço de Regulação e Inspeção de
              Jogos). É gratuita e pode escolher a duração.
            </AppText>
            <AppText
              variant="small"
              style={{ marginTop: spacing.md, textDecorationLine: 'underline' }}
              onPress={() => void Linking.openURL('https://www.srij.turismodeportugal.pt/pt/sos-jogadores/autoexclusao-e-proibicao')}
            >
              Saber mais sobre a autoexclusão
            </AppText>
            <AppText variant="small" tone="secondary" style={{ marginTop: spacing.md }}>
              Precisa de falar com alguém? Linha Vida 1414 (ICAD) — gratuita, anónima e confidencial, em dias úteis.
            </AppText>
            <AppText variant="small" style={{ marginTop: spacing.sm, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL('tel:1414')}>
              Ligar 1414
            </AppText>
          </AppCard>
        </>
      ) : null}

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
  lock: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: 14, borderWidth: 1, marginBottom: spacing.lg },
});
