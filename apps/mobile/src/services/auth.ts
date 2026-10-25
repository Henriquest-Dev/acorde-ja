import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { getSupabase, requireSupabase } from './supabase';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(getSupabase()));
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

const redirectTo = () => Linking.createURL('auth/callback');

export async function signUp(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
  return { needsVerification: !data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) throw error;
}

export async function resendVerification(email: string) {
  const { error } = await requireSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

/** Termina todas as sessões noutros dispositivos. */
export async function signOutOtherDevices() {
  const { error } = await requireSupabase().auth.signOut({ scope: 'others' });
  if (error) throw error;
}

/** Login com Google/Apple via OAuth (activo apenas quando configurado no Supabase). */
export async function signInWithProvider(provider: 'google' | 'apple') {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo(), skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo());
  if (result.type !== 'success') return false;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Resposta de autenticação inválida');
  const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
  if (exErr) throw exErr;
  return true;
}

/** Elimina a conta e todos os dados no servidor (Edge Function com service role). */
export async function deleteAccount() {
  const sb = requireSupabase();
  const { error } = await sb.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await sb.auth.signOut({ scope: 'local' });
}
