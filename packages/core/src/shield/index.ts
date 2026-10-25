/**
 * Digital Shield — protecção voluntária por categorias de domínios.
 *
 * As listas incluídas são sementes mínimas para testes e funcionamento
 * offline. Em produção devem ser complementadas por listas mantidas
 * (descarregadas via configuração remota) — ver docs/digital-shield.md.
 */

import { isScheduleActive, type BlockSchedule } from '../rules/engine';

export type ShieldCategory = 'adult' | 'gambling' | 'social' | 'games' | 'streaming';

export const SHIELD_CATEGORIES: { id: ShieldCategory; label: string; description: string }[] = [
  { id: 'adult', label: 'Sites adultos', description: 'Pornografia e conteúdo sexual explícito.' },
  { id: 'gambling', label: 'Sites de apostas', description: 'Casinos, apostas desportivas e póquer online.' },
  { id: 'social', label: 'Redes sociais', description: 'Versões web das redes sociais.' },
  { id: 'games', label: 'Jogos online', description: 'Portais de jogos no navegador.' },
  { id: 'streaming', label: 'Vídeo e streaming', description: 'Plataformas de vídeo e streaming.' },
];

export const SEED_DOMAINS: Record<ShieldCategory, string[]> = {
  adult: ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com', 'onlyfans.com', 'chaturbate.com'],
  gambling: [
    'bet365.com', 'betano.pt', 'betano.com', 'betclic.pt', 'placard.pt', 'solverde.pt', 'casinoportugal.pt',
    'pokerstars.pt', 'bwin.com', '888casino.com', 'betfair.com', 'stake.com', 'esconline.pt', 'nossaaposta.pt',
  ],
  social: ['instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'snapchat.com', 'reddit.com'],
  games: ['poki.com', 'crazygames.com', 'miniclip.com', 'roblox.com'],
  streaming: ['youtube.com', 'netflix.com', 'twitch.tv', 'primevideo.com', 'disneyplus.com'],
};

export interface ShieldConfig {
  categories: Record<ShieldCategory, boolean>;
  customDomains: string[];
  /** Domínios sempre permitidos (sobrepõem-se às categorias, nunca ao modo estrito). */
  allowDomains: string[];
  strictMode: boolean;
  schedule: BlockSchedule | null;
}

export const DEFAULT_SHIELD: ShieldConfig = {
  categories: { adult: false, gambling: false, social: false, games: false, streaming: false },
  customDomains: [],
  allowDomains: [],
  strictMode: false,
  schedule: null,
};

/** Normaliza entradas do utilizador: "https://www.Exemplo.pt/x" → "exemplo.pt". */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0]!.split(':')[0]!;
  s = s.replace(/^\*\./, '').replace(/^www\./, '').replace(/\.$/, '');
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)) return null;
  return s;
}

/** Verdadeiro se `host` é `domain` ou um subdomínio dele. */
export function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export type ShieldVerdict = { blocked: false } | { blocked: true; reason: ShieldCategory | 'custom' | 'schedule' };

export function evaluateDomain(
  hostInput: string,
  config: ShieldConfig,
  now: Date,
  lists: Record<ShieldCategory, string[]> = SEED_DOMAINS,
): ShieldVerdict {
  const host = normalizeDomain(hostInput);
  if (!host) return { blocked: false };
  if (!config.strictMode && config.allowDomains.some((d) => matchesDomain(host, d))) return { blocked: false };
  for (const cat of Object.keys(lists) as ShieldCategory[]) {
    if (config.categories[cat] && lists[cat].some((d) => matchesDomain(host, d))) return { blocked: true, reason: cat };
  }
  if (config.customDomains.some((d) => matchesDomain(host, d))) {
    if (!config.schedule || isScheduleActive(config.schedule, now)) return { blocked: true, reason: 'custom' };
  }
  return { blocked: false };
}

export function activeDomainList(config: ShieldConfig, lists: Record<ShieldCategory, string[]> = SEED_DOMAINS): string[] {
  const set = new Set<string>(config.customDomains);
  for (const cat of Object.keys(lists) as ShieldCategory[]) if (config.categories[cat]) lists[cat].forEach((d) => set.add(d));
  return [...set].sort();
}
