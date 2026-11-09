/**
 * Só em desenvolvimento na web: expõe `window.__offly` para capturas de ecrã automáticas
 * (saltar o onboarding, semear conversas e dados de exemplo). Nunca entra numa build de produção.
 */
import type { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { addMessage } from '@/repositories/chat';
import { kvGet, kvSet } from '@/repositories/kv';
import { usePrefs } from '@/stores/prefs';

export function installDevWebHook(queryClient: QueryClient) {
  if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return;
  (window as unknown as { __offly: unknown }).__offly = { usePrefs, queryClient, addMessage, kvGet, kvSet };
}
