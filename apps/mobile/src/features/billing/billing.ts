/**
 * Camada de compras com gateway EXTERNO (sem Google Play / App Store / RevenueCat).
 *
 * Fluxo:
 * 1. O app abre EXPO_PUBLIC_CHECKOUT_URL no navegador com plan, product, uid e email.
 * 2. O cliente paga no gateway escolhido.
 * 3. O gateway (ou uma automação) envia um evento assinado para a Edge Function
 *    `billing-webhook`, que actualiza `subscriptions` e `entitlements` no Supabase.
 * 4. O app lê o plano activo com `my_entitlements()`.
 *
 * Sem EXPO_PUBLIC_CHECKOUT_URL as funções falham de forma explícita — nunca
 * simulam uma compra nem desbloqueiam funcionalidades.
 */
import * as WebBrowser from 'expo-web-browser';
import { getSupabase, isBackendConfigured } from '@/services/supabase';
import type { PlanId, PlanPrice } from './plans';

const checkoutUrl = process.env.EXPO_PUBLIC_CHECKOUT_URL ?? null;
const portalUrl = process.env.EXPO_PUBLIC_BILLING_PORTAL_URL ?? null;

export const isBillingConfigured = Boolean(checkoutUrl && isBackendConfigured);

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

export type Entitlement = 'pro' | 'pro_ai' | 'family';

export interface EntitlementState {
  entitlements: Entitlement[];
  /** Fim do período pago mais distante; null = vitalício ou sem plano. */
  expiresAt: number | null;
}

/** Monta o URL de checkout do gateway (exportado para testes). */
export function buildCheckoutUrl(base: string, p: { planId: PlanId; productId: string; userId: string; email?: string | null }): string {
  const u = new URL(base);
  u.searchParams.set('plan', p.planId);
  u.searchParams.set('product', p.productId);
  // client_reference_id é o nome usado por vários gateways para «referência do cliente».
  u.searchParams.set('client_reference_id', p.userId);
  u.searchParams.set('uid', p.userId);
  if (p.email) u.searchParams.set('email', p.email);
  return u.toString();
}

async function currentUser() {
  const sb = getSupabase();
  if (!sb) throw new BillingNotConfiguredError();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new SignInRequiredError();
  return data.user;
}

/** Abre o checkout. O acesso só muda quando o webhook confirmar o pagamento. */
export async function purchase(planId: PlanId, price: PlanPrice): Promise<EntitlementState> {
  if (!isBillingConfigured || !checkoutUrl) throw new BillingNotConfiguredError();
  const user = await currentUser();
  await WebBrowser.openBrowserAsync(buildCheckoutUrl(checkoutUrl, { planId, productId: price.productId, userId: user.id, email: user.email }));
  return fetchEntitlements();
}

/** «Restaurar»: relê o plano da conta no servidor. */
export async function restorePurchases(): Promise<EntitlementState> {
  if (!isBillingConfigured) throw new BillingNotConfiguredError();
  await currentUser();
  return fetchEntitlements();
}

export async function fetchEntitlements(): Promise<EntitlementState> {
  const sb = getSupabase();
  if (!sb) return { entitlements: [], expiresAt: null };
  const { data, error } = await sb.rpc('my_entitlements');
  if (error || !Array.isArray(data)) return { entitlements: [], expiresAt: null };
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
