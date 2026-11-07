/**
 * Camada de compras. Ainda sem loja ligada: quando a configurar, defina
 * EXPO_PUBLIC_BILLING_PROVIDER (ex.: "revenuecat") e a chave pública
 * correspondente, e implemente `purchase`/`restore` com o SDK escolhido.
 * Até lá, as funções falham de forma explícita — nunca simulam uma compra.
 */
import type { PlanPrice } from './plans';

export const billingProvider = process.env.EXPO_PUBLIC_BILLING_PROVIDER ?? null;
export const isBillingConfigured = Boolean(billingProvider);

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Os pagamentos ainda não estão configurados nesta versão.');
    this.name = 'BillingNotConfiguredError';
  }
}

export async function purchase(_price: PlanPrice): Promise<void> {
  if (!isBillingConfigured) throw new BillingNotConfiguredError();
  throw new Error(`Fornecedor de pagamentos «${billingProvider}» ainda não implementado.`);
}

export async function restorePurchases(): Promise<void> {
  if (!isBillingConfigured) throw new BillingNotConfiguredError();
  throw new Error(`Fornecedor de pagamentos «${billingProvider}» ainda não implementado.`);
}
