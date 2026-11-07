/// <reference types="jest" />
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => null, isBackendConfigured: false }));
import { BillingNotConfiguredError, buildCheckoutUrl, purchase } from '@/features/billing/billing';

describe('faturação externa', () => {
  it('monta o URL de checkout com plano, produto e utilizador', () => {
    const u = new URL(buildCheckoutUrl('https://pay.example.com/checkout?ref=app', { planId: 'pro', productId: 'offly_pro_yearly', userId: 'u-1', email: 'a@b.pt' }));
    expect(u.searchParams.get('ref')).toBe('app');
    expect(u.searchParams.get('product')).toBe('offly_pro_yearly');
    expect(u.searchParams.get('client_reference_id')).toBe('u-1');
    expect(u.searchParams.get('email')).toBe('a@b.pt');
  });

  it('sem gateway configurado recusa a compra (nunca simula)', async () => {
    await expect(purchase('pro', { usd: 3.99, productId: 'offly_pro_monthly' })).rejects.toBeInstanceOf(BillingNotConfiguredError);
  });
});
