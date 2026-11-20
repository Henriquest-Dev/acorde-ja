/// <reference types="jest" />
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `acordeja://${p}` }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => null, isBackendConfigured: false }));
import * as WebBrowser from 'expo-web-browser';
import { BillingError, BillingNotConfiguredError, purchase, restorePurchases } from '@/features/billing/billing';
import { PLANS } from '@/features/billing/plans';

describe('faturação PayPal', () => {
  it('sem servidor recusa a compra e nunca abre o PayPal nem simula', async () => {
    await expect(purchase('pro', { usd: 3.99, productId: 'offly_pro_monthly' })).rejects.toBeInstanceOf(BillingNotConfiguredError);
    await expect(restorePurchases()).rejects.toBeInstanceOf(BillingNotConfiguredError);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('erros do servidor têm mensagens claras', () => {
    expect(new BillingError('already_subscribed').message).toMatch(/já tens/i);
    expect(new BillingError('xpto').message).toMatch(/tenta de novo/i);
  });

  it('os produtos do app são os mesmos que o servidor conhece no PayPal', () => {
    const ids = PLANS.flatMap((p) => Object.values(p.prices).map((x) => x!.productId)).sort();
    expect(ids).toEqual(['offly_family_yearly', 'offly_pro_ai_monthly', 'offly_pro_ai_yearly', 'offly_pro_monthly', 'offly_pro_yearly']);
  });
});
