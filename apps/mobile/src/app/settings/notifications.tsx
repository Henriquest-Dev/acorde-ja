import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { AppHeader, AppPermissionCard, AppSwitch, ListRow, Screen, SectionTitle, toast } from '@/components';
import { getPermissions, openSystemSettings, requestNotifications } from '@/native/device';
import { syncWeeklySummary } from '@/services/notifications';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs, type Prefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

const ROWS: { key: keyof Prefs['notifications']; title: string; subtitle: string }[] = [
  { key: 'limitWarnings', title: 'Avisos de limite', subtitle: 'Aos 80% e ao atingir o limite' },
  { key: 'focusEnd', title: 'Fim da sessão de foco', subtitle: 'Mesmo com o aplicativo fechado' },
  { key: 'habitReminders', title: 'Lembretes de hábitos', subtitle: 'À hora que definir em cada hábito' },
  { key: 'weeklySummary', title: 'Resumo semanal', subtitle: 'Uma vez por semana, ao domingo' },
];

export default function NotificationsSettings() {
  const { prefs, update } = usePrefs();
  const perms = useQuery({ queryKey: ['permissions-notifications'], queryFn: getPermissions });
  const state = perms.data?.notifications ?? 'not_determined';

  return (
    <Screen>
      <AppHeader title="Notificações" back />
      <AppPermissionCard
        icon="bell"
        title="Permissão do sistema"
        description="Sem esta permissão não conseguimos avisar quando se aproxima do limite."
        state={state}
        actionLabel={state === 'denied' ? 'Abrir definições' : 'Permitir notificações'}
        onRequest={async () => {
          if (state === 'denied') await openSystemSettings('notifications').catch(() => toast('Abra as definições do sistema.', 'error'));
          else await requestNotifications();
          void perms.refetch();
        }}
      />
      <SectionTitle>Tipos</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {ROWS.map((r) => (
          <ListRow
            key={r.key}
            title={r.title}
            subtitle={r.subtitle}
            right={
              <AppSwitch
                value={prefs.notifications[r.key]}
                onValueChange={async (v) => {
                  await update((p) => ({ notifications: { ...p.notifications, [r.key]: v } }));
                  if (r.key === 'weeklySummary') await syncWeeklySummary(v);
                  if (r.key === 'limitWarnings') await syncRulesToNative();
                }}
                accessibilityLabel={r.title}
              />
            }
          />
        ))}
      </View>
    </Screen>
  );
}
