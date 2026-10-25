import { useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppPermissionCard, AppSkeleton, AppText, Screen, SectionTitle, toast } from '@/components';
import { RestrictedSettingsHelp } from '@/features/onboarding/RestrictedSettingsHelp';
import { activateEnforcement, requestPermission, usePermissionSummary, type PermissionKey } from '@/features/onboarding/usePermissionSummary';
import { stopEnforcement } from '@/native/device';
import { spacing } from '@/theme/tokens';

const ICONS = { usage: 'activity', apps: 'lock', sites: 'globe' } as const;

/** Estado real das permissões e do serviço de aplicação de regras. */
export default function PermissionsSettings() {
  const { data, isLoading, refetch } = usePermissionSummary();
  const [busy, setBusy] = useState(false);

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
