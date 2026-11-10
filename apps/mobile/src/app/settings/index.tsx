import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { AppHeader, AppText, ListRow, Screen, type RowIcon } from '@/components';
import { spacing } from '@/theme/tokens';

const ITEMS: { title: string; icon: RowIcon; href: Href }[] = [
  { title: 'Apps que me distraem', icon: { set: 'mci', name: 'timer-sand' }, href: '/settings/limits' },
  { title: 'Proteção', icon: { set: 'feather', name: 'shield' }, href: '/protection' },
  { title: 'Horários de bloqueio', icon: { set: 'feather', name: 'clock' }, href: '/settings/schedules' },
  { title: 'Família', icon: { set: 'feather', name: 'users' }, href: '/family' },
  { title: 'Offy e voz', icon: { set: 'feather', name: 'mic' }, href: '/settings/assistant' },
  { title: 'Notificações', icon: { set: 'feather', name: 'bell' }, href: '/settings/notifications' },
];

const MORE: { title: string; icon: RowIcon; href: Href }[] = [
  { title: 'A minha conta', icon: { set: 'feather', name: 'user' }, href: '/settings/sync' },
  { title: 'Planos', icon: { set: 'feather', name: 'credit-card' }, href: '/settings/billing' },
  { title: 'Permissões do telemóvel', icon: { set: 'mci', name: 'shield-check-outline' }, href: '/settings/permissions' },
  { title: 'Ecrã inicial (launcher)', icon: { set: 'feather', name: 'smartphone' }, href: '/settings/launcher' },
  { title: 'Aparência', icon: { set: 'feather', name: 'sun' }, href: '/settings/appearance' },
  { title: 'Os meus dados', icon: { set: 'feather', name: 'lock' }, href: '/settings/privacy' },
  { title: 'Ajuda e sobre', icon: { set: 'feather', name: 'help-circle' }, href: '/settings/help' },
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
        offly {Constants.expoConfig?.version ?? ''} · Menos tela. Mais vida.
      </AppText>
    </Screen>
  );
}
