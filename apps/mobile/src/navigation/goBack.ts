import { router, type Href } from 'expo-router';

/** Volta ao ecrã anterior; sem histórico (ex.: aberto por deep link), vai para `fallback`. */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
