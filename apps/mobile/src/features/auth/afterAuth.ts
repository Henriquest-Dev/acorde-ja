import { router } from 'expo-router';
import { goBack } from '@/navigation/goBack';
import { usePrefs } from '@/stores/prefs';

/** Depois de entrar: primeira vez → onboarding; mudança de conta nas definições → volta atrás. */
export function afterAuth(name?: string) {
  const { onboardingDone, signedIn } = usePrefs.getState().prefs;
  const switching = onboardingDone && signedIn;
  // Conta criada/entrada: sincroniza sozinho e o assistente fica disponível (aceite nos termos ao criar conta).
  void usePrefs
    .getState()
    .update({ signedIn: true, cloudSync: true, aiConsent: true, ...(name ? { displayName: name.trim() } : {}) })
    .then(() => (switching ? goBack('/settings/sync') : router.replace(onboardingDone ? '/' : '/onboarding')));
}
