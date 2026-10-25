import { getSupabase } from './supabase';

/**
 * Regista a decisão de consentimento no servidor (consent_records), quando há
 * sessão. A decisão local já foi aplicada; este registo serve de prova (RGPD).
 */
export async function recordConsent(purpose: string, granted: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  const { error } = await sb.from('consent_records').insert({ purpose, granted, policy_version: '2026-10' });
  if (error) throw error;
}
