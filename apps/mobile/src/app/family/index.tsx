import { WEEK_INITIALS, addDays, dayKey, startOfWeek } from '@acorde/core';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import {
  AppBarChart,
  AppBottomSheet,
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppHeader,
  AppInput,
  AppSkeleton,
  AppText,
  HeaderIconButton,
  ListRow,
  Screen,
  SectionTitle,
  toast,
} from '@/components';
import { useSession } from '@/services/auth';
import { createFamilyGroup, decideRequest, joinFamilyGroup, leaveFamilyGroup, loadFamily, type FamilyMember } from '@/services/family';
import { isBackendConfigured } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Família — controlo parental transparente. */
export default function Family() {
  const { colors } = useTheme();
  const { session, loading } = useSession();
  const monday = startOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
  const family = useQuery({ queryKey: ['family', weekDays[0]], queryFn: () => loadFamily(weekDays), enabled: !!session });
  const [sheet, setSheet] = useState<'create' | 'join' | 'requests' | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      setSheet(null);
      await family.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Operação falhou', 'error');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <AppHeader
      title="Família"
      back
      right={
        family.data?.group && family.data.isGuardian ? (
          <HeaderIconButton
            icon="plus"
            label="Convidar membro"
            onPress={() => void Share.share({ message: `Junte-se à família «${family.data!.group!.name}» no Acorde Já com o código ${family.data!.group!.inviteCode}.` })}
          />
        ) : undefined
      }
    />
  );

  if (!isBackendConfigured || (!loading && !session)) {
    return (
      <Screen>
        {header}
        <AppEmptyState
          icon="users"
          title="A família precisa de uma conta"
          message={
            isBackendConfigured
              ? 'Inicie sessão para criar um grupo familiar ou juntar-se a um.'
              : 'Os grupos familiares usam o servidor do Acorde Já, que não está configurado nesta instalação.'
          }
          actionLabel={isBackendConfigured ? 'Iniciar sessão' : undefined}
          onAction={isBackendConfigured ? () => router.push('/auth/sign-in') : undefined}
        />
      </Screen>
    );
  }

  const data = family.data;
  const age = (m: FamilyMember) => (m.birthYear ? `${new Date().getFullYear() - m.birthYear} anos` : m.role === 'guardian' ? 'Encarregado' : 'Membro');

  return (
    <Screen refreshing={family.isRefetching} onRefresh={() => void family.refetch()}>
      {header}
      {family.isLoading ? (
        <View style={{ gap: spacing.md }}>
          <AppSkeleton height={60} />
          <AppSkeleton height={60} />
        </View>
      ) : family.isError ? (
        <AppErrorState message="Não foi possível carregar a família." onRetry={() => void family.refetch()} />
      ) : !data?.group ? (
        <>
          <AppEmptyState icon="users" title="Ainda sem grupo familiar" message="Crie um grupo para acompanhar, com transparência, o tempo de ecrã dos seus filhos — ou junte-se com um código." />
          <View style={{ gap: spacing.md }}>
            <AppButton label="Criar grupo familiar" onPress={() => setSheet('create')} />
            <AppButton label="Tenho um código" variant="secondary" onPress={() => setSheet('join')} />
          </View>
        </>
      ) : (
        <>
          <View style={{ gap: spacing.md }}>
            {data.members.map((m) => (
              <ListRow
                key={m.id}
                leading={
                  <View style={[styles.avatar, { backgroundColor: colors.elevated, borderColor: colors.borderStrong }]}>
                    <AppText variant="bodyStrong">{m.displayName.charAt(0).toUpperCase()}</AppText>
                  </View>
                }
                title={m.displayName}
                subtitle={m.status === 'invited' ? 'Convite pendente' : age(m)}
                chevron
                onPress={() => toast(m.role === 'guardian' ? 'Encarregado de educação do grupo.' : 'Os detalhes partilhados são apenas totais diários.')}
              />
            ))}
          </View>

          {data.isGuardian ? (
            <>
              <SectionTitle>Relatório semanal</SectionTitle>
              <AppBarChart
                data={data.weekly.map((w, i) => ({ key: w.day, label: WEEK_INITIALS[i]!, value: w.minutes, valueLabel: `${Math.floor(w.minutes / 60)}h ${w.minutes % 60}min` }))}
                height={110}
                yTicks={['4h', '3h', '2h', '1h', '0h']}
              />
              <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
                <ListRow
                  icon={{ set: 'mci', name: 'timer-plus-outline' }}
                  title="Pedir tempo adicional"
                  right={
                    data.pendingRequests.length ? (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <AppText variant="caption" weight="bold" style={{ color: colors.onAccent }}>
                          {data.pendingRequests.length}
                        </AppText>
                      </View>
                    ) : undefined
                  }
                  onPress={() => setSheet('requests')}
                />
                <ListRow icon={{ set: 'feather', name: 'settings' }} title="Configurações" chevron onPress={() => router.push('/settings')} />
              </View>
            </>
          ) : (
            <AppText variant="small" tone="muted" style={{ marginTop: spacing.xl }}>
              O seu encarregado vê apenas o total diário de tempo de ecrã — nunca as suas mensagens, sites ou conversas.
            </AppText>
          )}
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xl }}>
            Código do grupo: {data.group.inviteCode}
          </AppText>
          <AppButton label="Sair do grupo" variant="ghost" size="sm" onPress={() => void run(leaveFamilyGroup, 'Saiu do grupo.')} style={{ marginTop: spacing.md }} />
        </>
      )}

      <AppBottomSheet visible={sheet === 'create'} onClose={() => setSheet(null)} title="Criar grupo familiar">
        <View style={{ gap: spacing.lg }}>
          <AppInput label="Nome do grupo" value={name} onChangeText={setName} placeholder="Família Silva" />
          <AppInput label="O seu nome" value={displayName} onChangeText={setDisplayName} placeholder="Ana" />
          <AppButton label="Criar" loading={busy} disabled={name.trim().length < 2 || displayName.trim().length < 2} onPress={() => void run(() => createFamilyGroup(name.trim(), displayName.trim()), 'Grupo criado.')} />
        </View>
      </AppBottomSheet>

      <AppBottomSheet visible={sheet === 'join'} onClose={() => setSheet(null)} title="Juntar-me a uma família">
        <View style={{ gap: spacing.lg }}>
          <AppInput label="Código" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABC123" />
          <AppInput label="O seu nome" value={displayName} onChangeText={setDisplayName} />
          <AppInput label="Ano de nascimento (opcional)" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" maxLength={4} />
          <AppText variant="caption" tone="muted">
            Ao juntar-se, o encarregado passa a ver o total diário do seu tempo de ecrã. Pode sair a qualquer momento.
          </AppText>
          <AppButton
            label="Juntar-me"
            loading={busy}
            disabled={code.trim().length < 4 || displayName.trim().length < 2}
            onPress={() => void run(() => joinFamilyGroup(code, displayName.trim(), birthYear ? Number(birthYear) : null), 'Bem-vindo ao grupo.')}
          />
        </View>
      </AppBottomSheet>

      <AppBottomSheet visible={sheet === 'requests'} onClose={() => setSheet(null)} title="Pedidos de tempo adicional">
        {data?.pendingRequests.length ? (
          <View style={{ gap: spacing.lg }}>
            {data.pendingRequests.map((r) => (
              <View key={r.id} style={{ gap: spacing.sm }}>
                <AppText variant="bodyStrong">
                  {r.memberName} · +{r.extraMinutes} min
                </AppText>
                <AppText variant="small" tone="muted">
                  {r.appId} · {r.reason}
                </AppText>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <AppButton label="Aprovar" size="sm" style={{ flex: 1 }} onPress={() => void run(() => decideRequest(r.id, true), 'Pedido aprovado.')} />
                  <AppButton label="Recusar" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => void run(() => decideRequest(r.id, false), 'Pedido recusado.')} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Feather name="inbox" size={24} color={colors.textMuted} />
            <AppText variant="small" tone="muted">
              Sem pedidos pendentes.
            </AppText>
          </View>
        )}
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
