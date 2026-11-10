/** Nome, país e linhas de ajuda: guardados no telemóvel e no perfil da conta (para voltar a aparecer noutro telemóvel). */
import type { HelpLines } from '@/features/country/countries';
import { usePrefs } from '@/stores/prefs';
import { getSupabase } from './supabase';

export async function saveProfile(p: { name: string; country: string; language: 'pt-PT' | 'pt-BR'; helpLines: Partial<HelpLines> }) {
  await usePrefs.getState().update({ displayName: p.name.trim(), country: p.country, language: p.language, helpLines: p.helpLines });
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  // Sem bloquear: se estiver offline, fica guardado no telemóvel e o perfil actualiza depois.
  await Promise.allSettled([
    sb.from('profiles').update({ display_name: p.name.trim().slice(0, 60), country: p.country === 'XX' ? null : p.country, help_lines: p.helpLines, locale: p.language }).eq('id', data.user.id),
    sb.auth.updateUser({ data: { display_name: p.name.trim(), country: p.country, language: p.language } }),
  ]);
}

/** Depois de entrar: se a conta já tem nome/país, traz para o telemóvel (não pergunta outra vez). */
export async function pullProfile(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: u } = await sb.auth.getSession();
  const user = u.session?.user;
  if (!user) return;
  const prefs = usePrefs.getState().prefs;
  const meta = (user.user_metadata ?? {}) as { display_name?: string; country?: string; language?: 'pt-PT' | 'pt-BR' };
  const { data: row } = await sb.from('profiles').select('display_name, country, help_lines, locale').eq('id', user.id).maybeSingle();
  const name = prefs.displayName || row?.display_name || meta.display_name || '';
  const country = prefs.country || row?.country || meta.country || '';
  const language = (row?.locale === 'pt-BR' || meta.language === 'pt-BR' ? 'pt-BR' : prefs.language) as 'pt-PT' | 'pt-BR';
  const helpLines = Object.keys(prefs.helpLines).length ? prefs.helpLines : ((row?.help_lines as Partial<HelpLines> | null) ?? {});
  if (name !== prefs.displayName || country !== prefs.country || language !== prefs.language || helpLines !== prefs.helpLines) {
    await usePrefs.getState().update({ displayName: name, country, language: prefs.country ? prefs.language : language, helpLines });
  }
}
