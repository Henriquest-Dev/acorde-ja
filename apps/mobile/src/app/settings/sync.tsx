import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppCard, AppEmptyState, AppHeader, AppSwitch, AppText, ListRow, Screen, SectionTitle, toast } from '@/components';
import { deadLetters, retryDeadLetters } from '@/repositories/syncStore';
import { signOut, signOutOtherDevices, useSession } from '@/services/auth';
import { recordConsent } from '@/services/consent';
import { isBackendConfigured } from '@/services/supabase';
import { flushSync, syncQueue } from '@/services/sync';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** Sincronização na nuvem: conta, consentimento e estado da fila offline. */
export default function SyncSettings() {
  const { session } = useSession();
  const { prefs, update } = usePrefs();
  const [busy, setBusy] = useState(false);
  const counts = useQuery({ queryKey: ['sync-counts'], queryFn: () => syncQueue.counts(), refetchInterval: 5000 });
  const dead = useQuery({ queryKey: ['sync-dead'], queryFn: deadLetters });

  if (!isBackendConfigured) {
    return (
      <Screen>
        <AppHeader title="Sincronização na nuvem" back />
        <AppEmptyState
          icon="cloud-off"
          title="Servidor não configurado"
          message="Esta instalação funciona apenas localmente. Para activar contas e sincronização, configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (ver docs/setup.md)."
        />
      </Screen>
    );
  }

  const syncNow = async () => {
    setBusy(true);
    try {
      const r = await flushSync();
      toast(r ? `Enviados ${r.sent} · falhados ${r.failed}` : 'Active a sincronização primeiro.');
      void counts.refetch();
      void dead.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha na sincronização', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Sincronização na nuvem" back />
      {session ? (
        <AppCard>
          <AppText variant="bodyStrong">{session.user.email}</AppText>
          <AppText variant="caption" tone="muted">
            {session.user.email_confirmed_at ? 'Email verificado' : 'Email por verificar'}
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <AppButton label="Terminar sessão" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => void signOut().catch((e) => toast(String(e), 'error'))} />
            <AppButton label="Sair dos outros dispositivos" size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => void signOutOtherDevices().then(() => toast('Sessões terminadas.'))} />
          </View>
        </AppCard>
      ) : (
        <AppCard>
          <AppText variant="small" tone="secondary">
            Crie uma conta para guardar os seus dados na nuvem e usar o assistente e a família. O aplicativo continua a funcionar sem conta.
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <AppButton label="Entrar" size="sm" style={{ flex: 1 }} onPress={() => router.push('/auth/sign-in')} />
            <AppButton label="Criar conta" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/auth/sign-up')} />
          </View>
        </AppCard>
      )}

      <SectionTitle>Sincronização</SectionTitle>
      <ListRow
        title="Sincronizar automaticamente"
        subtitle="Ao abrir o aplicativo e ao recuperar a ligação"
        right={
          <AppSwitch
            value={prefs.cloudSync}
            disabled={!session}
            onValueChange={async (v) => {
              await update({ cloudSync: v });
              await recordConsent('cloudSync', v).catch(() => undefined);
            }}
            accessibilityLabel="Sincronizar automaticamente"
          />
        }
      />
      <AppCard style={{ marginTop: spacing.md }}>
        <AppText variant="small">Pendentes: {counts.data?.pending ?? 0}</AppText>
        <AppText variant="small">Com erro: {counts.data?.dead ?? 0}</AppText>
        {dead.data?.slice(0, 3).map((d) => (
          <AppText key={d.id} variant="caption" tone="muted">
            {d.table}: {d.lastError}
          </AppText>
        ))}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <AppButton label="Sincronizar agora" size="sm" style={{ flex: 1 }} loading={busy} disabled={!session || !prefs.cloudSync} onPress={syncNow} />
          {counts.data?.dead ? (
            <AppButton label="Repetir falhados" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => void retryDeadLetters().then(syncNow)} />
          ) : null}
        </View>
      </AppCard>
    </Screen>
  );
}
