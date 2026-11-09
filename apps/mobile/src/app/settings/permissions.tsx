import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppPermissionCard, AppSkeleton, AppText, Screen, SectionTitle, toast } from '@/components';
import { RestrictedSettingsHelp } from '@/features/onboarding/RestrictedSettingsHelp';
import { activateEnforcement, requestPermission, usePermissionSummary, type PermissionKey } from '@/features/onboarding/usePermissionSummary';
import { stopEnforcement, strongBlock } from '@/native/device';
import { spacing } from '@/theme/tokens';

const ICONS = { usage: 'activity', apps: 'lock', sites: 'globe' } as const;

/** Estado real das permissões e do serviço de aplicação de regras. */
export default function PermissionsSettings() {
  const { data, isLoading, refetch } = usePermissionSummary();
  const [busy, setBusy] = useState(false);
  const strong = useQuery({ queryKey: ['strong-block'], queryFn: () => strongBlock.isEnabled(), enabled: Platform.OS === 'android' });
  // Ao voltar das definições do sistema, actualiza o estado.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        void strong.refetch();
        void refetch();
      }
    });
    return () => sub.remove();
  }, [strong, refetch]);

  const ask = async (key: PermissionKey) => {
    try {
      await requestPermission(key);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha ao pedir permissão', 'error');
    }
    void refetch();
  };

  return (
    <Screen>
      <AppHeader title="Permissões do sistema" back />
      <View style={{ gap: spacing.md }}>
        {isLoading
          ? [0, 1, 2].map((i) => <AppSkeleton key={i} height={90} />)
          : data?.items.map((i) => (
              <AppPermissionCard key={i.key} icon={ICONS[i.key]} title={i.title} description={i.description} state={i.state} onRequest={() => void ask(i.key)} />
            ))}
      </View>

      <RestrictedSettingsHelp items={data?.items ?? []} />

      {Platform.OS === 'android' ? (
        <>
          <SectionTitle>Bloqueio reforçado (recomendado)</SectionTitle>
          <AppCard testID="strong-block">
            <AppText variant="bodyStrong">{strong.data ? 'Activo' : 'Desligado'}</AppText>
            <AppText variant="small" tone="secondary" style={{ marginTop: spacing.xs }}>
              Fecha de imediato o YouTube, os Shorts e as outras apps que já esgotaram o limite, mesmo que tente voltar a abri-las. Sem
              isto, o Android só avisa o offly com alguns segundos de atraso.
            </AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              Usa o serviço de acessibilidade apenas para saber que app está aberta. Não lê nem guarda o conteúdo do ecrã.
            </AppText>
            {!strong.data ? (
              <>
                <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                  Em Definições → Acessibilidade → Apps instaladas → «offly: bloqueio reforçado» → Activar. Se aparecer «Definição
                  restrita», abra Informações da app → ⋮ → Permitir definições restritas, e volte a tentar.
                </AppText>
                <AppButton
                  label="Activar bloqueio reforçado"
                  size="sm"
                  style={{ marginTop: spacing.md }}
                  onPress={() => void strongBlock.open().catch(() => toast('Não foi possível abrir as definições de acessibilidade.', 'error'))}
                  testID="enable-strong-block"
                />
              </>
            ) : null}
          </AppCard>
        </>
      ) : null}

      <SectionTitle>Aplicação de regras</SectionTitle>
      <AppCard>
        <AppText variant="bodyStrong">{data?.caps.enforcementRunning ? 'Activa' : 'Inactiva'}</AppText>
        <AppText variant="caption" tone="muted">
          {data?.caps.osVersion} · medir: {data?.caps.canMeasureUsage ? 'sim' : 'não'} · restringir: {data?.caps.canRestrictApps ? 'sim' : 'não'}
        </AppText>
        {data?.caps.notes.map((n) => (
          <AppText key={n} variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
            • {n}
          </AppText>
        ))}
        <AppButton
          label={data?.caps.enforcementRunning ? 'Parar serviço' : 'Iniciar serviço'}
          size="sm"
          variant="secondary"
          loading={busy}
          style={{ marginTop: spacing.md }}
          onPress={async () => {
            setBusy(true);
            if (data?.caps.enforcementRunning) await stopEnforcement();
            else if (!(await activateEnforcement())) toast('Conceda primeiro o acesso aos dados de utilização.', 'error');
            setBusy(false);
            void refetch();
          }}
        />
      </AppCard>
    </Screen>
  );
}
