/**
 * Acesso às funções pagas. A fonte de verdade é o servidor (`my_entitlements`);
 * o telemóvel guarda o último resultado para funcionar offline, só até à data
 * de fim que o servidor indicou. O assistente IA é também verificado no servidor.
 */
import { router } from 'expo-router';
import { toast } from '@/components';
import { usePrefs } from '@/stores/prefs';
import { fetchEntitlements } from './billing';

export type Feature = 'unlimited_limits' | 'intention_pause' | 'site_protection' | 'challenge' | 'schedules' | 'reports' | 'assistant';

/** Apps com limite no plano Grátis. */
export const FREE_LIMIT_APPS = 3;

const NEEDS: Record<Feature, 'pro' | 'pro_ai'> = {
  unlimited_limits: 'pro',
  intention_pause: 'pro',
  site_protection: 'pro',
  challenge: 'pro',
  schedules: 'pro',
  reports: 'pro',
  assistant: 'pro_ai',
};

const LABEL: Record<Feature, string> = {
  unlimited_limits: 'Mais de 3 apps com limite',
  intention_pause: 'A pausa antes de abrir apps',
  site_protection: 'A proteção de sites',
  challenge: 'O desafio trancado',
  schedules: 'Os horários de bloqueio',
  reports: 'Os relatórios completos',
  assistant: 'O assistente Offy',
};

type PlanCache = { entitlements: string[]; until: number | null; checkedAt: number };

export function activeEntitlements(plan: PlanCache, now = Date.now()): string[] {
  if (plan.until !== null && plan.until <= now) return [];
  return plan.entitlements;
}

export function canUse(feature: Feature, plan: PlanCache, now = Date.now()): boolean {
  return activeEntitlements(plan, now).includes(NEEDS[feature]);
}

/** Hook: true se a conta tem acesso a esta função. */
export function useCanUse(feature: Feature): boolean {
  const plan = usePrefs((s) => s.prefs.plan);
  return canUse(feature, plan);
}

/** Se não tiver acesso, explica e abre os Planos. Devolve true se pode continuar. */
export function requirePlan(feature: Feature): boolean {
  if (canUse(feature, usePrefs.getState().prefs.plan)) return true;
  const need = NEEDS[feature] === 'pro_ai' ? 'Pro + IA' : 'Pro';
  toast(`${LABEL[feature]} faz parte do plano ${need}.`);
  router.push('/settings/billing');
  return false;
}

let inflight: Promise<void> | null = null;

/** Relê o plano no servidor e actualiza a cache. Sem internet, mantém a cache. */
export function refreshPlan(): Promise<void> {
  inflight ??= (async () => {
    try {
      const st = await fetchEntitlements();
      if (st.error) return;
      await usePrefs.getState().update({ plan: { entitlements: st.entitlements, until: st.expiresAt, checkedAt: Date.now() } });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
