/**
 * Pagamentos com PayPal Subscriptions (sem Google Play / App Store).
 *
 * Fluxo, sem confiar no telemóvel:
 * 1. O app pede à Edge Function `paypal-checkout` uma subscrição para o plano.
 *    O servidor cria-a no PayPal já ligada a esta conta (custom_id = id do utilizador).
 * 2. O cliente aprova e paga no PayPal (navegador seguro).
 * 3. O app pede «confirm»: o servidor relê a subscrição na API do PayPal e só
 *    concede o acesso pago (ou o teste grátis, uma vez por conta PayPal).
 * 4. Renovações, cancelamentos e reembolsos chegam por `paypal-webhook`.
 * 5. O app lê o plano activo com `my_entitlements()`.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getSupabase, isBackendConfigured } from '@/services/supabase';
import type { PlanId, PlanPrice } from './plans';

/** Gerir ou cancelar a subscrição: pagamentos automáticos da conta PayPal. */
const portalUrl = process.env.EXPO_PUBLIC_BILLING_PORTAL_URL ?? 'https://www.paypal.com/myaccount/autopay/';

export const isBillingConfigured = isBackendConfigured;

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Os pagamentos ainda não estão configurados nesta versão.');
    this.name = 'BillingNotConfiguredError';
  }
}

export class SignInRequiredError extends Error {
  constructor() {
    super('Inicie sessão para subscrever: o plano fica associado à sua conta.');
    this.name = 'SignInRequiredError';
  }
}

export class FamilyMemberError extends Error {
  constructor(paidBy: string | null) {
    super(`Estás incluído no plano da família${paidBy ? ` de ${paidBy}` : ''}. Só o responsável gere os pagamentos.`);
    this.name = 'FamilyMemberError';
  }
}

export type Entitlement = 'pro' | 'pro_ai' | 'family';

export interface PlanInfo {
  /** Membro de um grupo família: usa o plano do responsável. */
  familyMember: boolean;
  canPurchase: boolean;
  paidBy: string | null;
}

/** Quem paga o plano desta conta (membros da família não podem comprar). */
export async function fetchPlanInfo(): Promise<PlanInfo> {
  const sb = getSupabase();
  if (!sb) return { familyMember: false, canPurchase: true, paidBy: null };
  const { data, error } = await sb.rpc('my_plan');
  if (error || !data) return { familyMember: false, canPurchase: true, paidBy: null };
  const d = data as { family_member?: boolean; can_purchase?: boolean; paid_by?: string | null };
  return { familyMember: d.family_member === true, canPurchase: d.can_purchase !== false, paidBy: d.paid_by ?? null };
}

export interface EntitlementState {
  entitlements: Entitlement[];
  /** Fim do período pago mais distante; null = vitalício ou sem plano. */
  expiresAt: number | null;
  /** O servidor não respondeu (sem internet): o resultado não deve substituir a cache. */
  error?: boolean;
}

async function currentUser() {
  const sb = getSupabase();
  if (!sb) throw new BillingNotConfiguredError();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new SignInRequiredError();
  return data.user;
}

export class BillingError extends Error {
  constructor(public code: string) {
    super(BILLING_MESSAGES[code] ?? 'Não foi possível concluir o pagamento. Tenta de novo daqui a pouco.');
    this.name = 'BillingError';
  }
}

const BILLING_MESSAGES: Record<string, string> = {
  already_subscribed: 'Já tens este plano activo.',
  family_member: 'Estás incluído no plano da família. Só o responsável gere os pagamentos.',
  rate_limited: 'Demasiadas tentativas. Espera um pouco e tenta de novo.',
  not_configured: 'Os pagamentos ainda não estão ligados no servidor.',
  paypal_unavailable: 'O PayPal não respondeu. Tenta de novo daqui a pouco.',
};

async function callCheckout<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  if (!sb) throw new BillingNotConfiguredError();
  const { data, error } = await sb.functions.invoke<T>('paypal-checkout', { body });
  if (error || !data) {
    let code = 'internal';
    try {
      const ctx = (error as { context?: Response } | null)?.context;
      const j = ctx ? ((await ctx.json()) as { error?: string }) : null;
      if (j?.error) code = j.error;
    } catch {
      /* resposta sem JSON */
    }
    throw new BillingError(code);
  }
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Abre o PayPal para o plano escolhido e, no regresso, pede ao servidor para confirmar.
 * O acesso só muda se o servidor confirmar o pagamento no PayPal.
 */
export async function purchase(_planId: PlanId, price: PlanPrice): Promise<EntitlementState> {
  if (!isBillingConfigured) throw new BillingNotConfiguredError();
  await currentUser();
  const info = await fetchPlanInfo();
  if (!info.canPurchase) throw new FamilyMemberError(info.paidBy);
  const { approveUrl, subscriptionId } = await callCheckout<{ approveUrl: string; subscriptionId: string }>({
    action: 'subscribe',
    productId: price.productId,
  });
  await WebBrowser.openAuthSessionAsync(approveUrl, Linking.createURL('settings/billing'));
  // A activação no PayPal pode demorar uns segundos: tenta confirmar algumas vezes.
  for (let i = 0; i < 4; i++) {
    try {
      await callCheckout({ action: 'confirm', subscriptionId });
    } catch {
      /* tenta de novo */
    }
    const state = await fetchEntitlements();
    if (state.entitlements.length) return state;
    await sleep(2500);
  }
  return fetchEntitlements();
}

/** «Restaurar»: o servidor relê no PayPal todas as subscrições desta conta. */
export async function restorePurchases(): Promise<EntitlementState> {
  if (!isBillingConfigured) throw new BillingNotConfiguredError();
  await currentUser();
  try {
    await callCheckout({ action: 'sync' });
  } catch {
    /* mostra o que o servidor já tem */
  }
  return fetchEntitlements();
}

export async function fetchEntitlements(): Promise<EntitlementState> {
  const sb = getSupabase();
  if (!sb) return { entitlements: [], expiresAt: null, error: true };
  const { data, error } = await sb.rpc('my_entitlements');
  if (error || !Array.isArray(data)) return { entitlements: [], expiresAt: null, error: true };
  const rows = data as { entitlement: Entitlement; expires_at: string | null }[];
  const times = rows.map((r) => (r.expires_at ? Date.parse(r.expires_at) : null));
  return {
    entitlements: rows.map((r) => r.entitlement),
    expiresAt: times.includes(null) || times.length === 0 ? null : Math.max(...(times as number[])),
  };
}

/** Página para gerir/cancelar a subscrição no gateway (se existir). */
export async function openBillingPortal(): Promise<boolean> {
  if (!portalUrl) return false;
  await WebBrowser.openBrowserAsync(portalUrl);
  return true;
}
