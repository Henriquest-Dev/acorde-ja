import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { AppHeader, AppText, ListRow, Screen, type RowIcon } from '@/components';
import { spacing } from '@/theme/tokens';

const ITEMS: { title: string; icon: RowIcon; href: Href }[] = [
  { title: 'Limites de aplicações', icon: { set: 'mci', name: 'timer-sand' }, href: '/settings/limits' },
  { title: 'Horários de bloqueio', icon: { set: 'feather', name: 'clock' }, href: '/settings/schedules' },
  { title: 'Proteção de sites', icon: { set: 'feather', name: 'globe' }, href: '/protection' },
  { title: 'Modo restrito', icon: { set: 'mci', name: 'timer-lock-outline' }, href: '/settings/strict' },
  { title: 'Notificações', icon: { set: 'feather', name: 'bell' }, href: '/settings/notifications' },
  { title: 'Interface e idioma', icon: { set: 'feather', name: 'info' }, href: '/settings/appearance' },
  { title: 'Privacidade e dados', icon: { set: 'feather', name: 'lock' }, href: '/settings/privacy' },
  { title: 'Sincronização na nuvem', icon: { set: 'feather', name: 'cloud' }, href: '/settings/sync' },
  { title: 'Ajuda e suporte', icon: { set: 'feather', name: 'help-circle' }, href: '/settings/help' },
];

const MORE: { title: string; icon: RowIcon; href: Href }[] = [
  { title: 'Permissões do sistema', icon: { set: 'mci', name: 'shield-check-outline' }, href: '/settings/permissions' },
  { title: 'Hábitos', icon: { set: 'feather', name: 'check-square' }, href: '/habits' },
  { title: 'Família', icon: { set: 'feather', name: 'users' }, href: '/family' },
];

/** Configurações — personalização e privacidade. */
export default function Settings() {
  return (
    <Screen testID="settings">
      <AppHeader title="Configurações" back />
      <View style={{ gap: spacing.sm }}>
        {ITEMS.map((i) => (
          <ListRow key={i.title} icon={i.icon} title={i.title} chevron onPress={() => router.push(i.href)} />
        ))}
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
        {MORE.map((i) => (
          <ListRow key={i.title} icon={i.icon} title={i.title} chevron onPress={() => router.push(i.href)} />
        ))}
      </View>
      <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.xxl }}>
        Acorde Já {Constants.expoConfig?.version ?? ''} · Menos tela. Mais vida.
      </AppText>
    </Screen>
  );
}
