import { router } from 'expo-router';
import { View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppText, ListRow, Screen, toast } from '@/components';
import { findCountry } from '@/features/country/countries';
import { signOut, signOutOtherDevices, useSession } from '@/services/auth';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** A minha conta: nome, país, email e terminar sessão. Tudo o resto é automático. */
export default function Account() {
  const { session } = useSession();
  const { prefs } = usePrefs();
  const country = findCountry(prefs.country);

  return (
    <Screen>
      <AppHeader title="A minha conta" back />
      <AppCard>
        <AppText variant="h3">{prefs.displayName || 'Sem nome'}</AppText>
        <AppText variant="small" tone="secondary">
          {session?.user.email ?? ''}
        </AppText>
      </AppCard>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <ListRow
          icon={{ set: 'feather', name: 'user' }}
          title="Nome, país e números de ajuda"
          subtitle={`${country?.name ?? 'País por escolher'} · ${prefs.language === 'pt-BR' ? 'Português do Brasil' : 'Português de Portugal'}`}
          chevron
          onPress={() => router.push('/profile-setup')}
        />
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
        Os teus limites e o teu progresso ficam guardados na tua conta automaticamente. O bloqueio funciona mesmo sem internet.
      </AppText>
      <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
        <AppButton label="Terminar sessão" variant="secondary" onPress={() => void signOut().catch(() => toast('Não foi possível terminar a sessão.', 'error'))} />
        <AppButton label="Sair nos outros telemóveis" variant="ghost" size="sm" onPress={() => void signOutOtherDevices().then(() => toast('Sessões terminadas.'))} />
      </View>
    </Screen>
  );
}
