import { router } from 'expo-router';
import { goBack } from '@/navigation/goBack';
import { usePrefs } from '@/stores/prefs';

/** Depois de entrar: primeira vez → onboarding; mudança de conta nas definições → volta atrás. */
export function afterAuth() {
  const { onboardingDone, signedIn } = usePrefs.getState().prefs;
  const switching = onboardingDone && signedIn;
  void usePrefs
    .getState()
    .update({ signedIn: true })
    .then(() => (switching ? goBack('/settings/sync') : router.replace(onboardingDone ? '/' : '/onboarding')));
}
