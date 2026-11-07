/**
 * Digital Shield — protecção voluntária por categorias de domínios.
 *
 * As listas incluídas são sementes mínimas para testes e funcionamento
 * offline. Em produção devem ser complementadas por listas mantidas
 * (descarregadas via configuração remota) — ver docs/digital-shield.md.
 */

import { isScheduleActive, type BlockSchedule } from '../rules/engine';

export type ShieldCategory = 'adult' | 'gambling' | 'ads' | 'social' | 'games' | 'streaming';

export const SHIELD_CATEGORIES: { id: ShieldCategory; label: string; description: string }[] = [
  { id: 'adult', label: 'Sites adultos', description: 'Pornografia e conteúdo sexual explícito.' },
  { id: 'gambling', label: 'Sites de apostas', description: 'Casinos, apostas desportivas e póquer online.' },
  { id: 'ads', label: 'Anúncios e rastreadores', description: 'Publicidade e rastreio em sites e apps.' },
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
  ads: [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'app-measurement.com',
    'ads.facebook.com', 'an.facebook.com', 'adnxs.com', 'taboola.com', 'outbrain.com', 'criteo.com', 'unityads.unity3d.com',
    'applovin.com', 'ads.tiktok.com', 'adcolony.com', 'moatads.com',
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
  categories: { adult: false, gambling: false, ads: false, social: false, games: false, streaming: false },
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
  // Domínios permitidos saem da lista (excepto em modo estrito).
  const allowed = config.strictMode ? [] : config.allowDomains;
  return [...set].filter((d) => !allowed.some((a) => matchesDomain(d, a))).sort();
}

/**
 * Resolvedores DNS públicos de filtragem usados como «upstream». Cobrem muito
 * mais domínios do que as listas locais (verificados em 2026-11):
 * - Cloudflare for Families: adultos + malware.
 * - AdGuard DNS: anúncios e rastreadores.
 * - AdGuard DNS Family: anúncios + adultos + pesquisa segura.
 */
export type ResolverId = 'cloudflare' | 'cloudflare_family' | 'adguard' | 'adguard_family';

export const RESOLVERS: Record<ResolverId, { ip: string; doh: string; label: string }> = {
  cloudflare: { ip: '1.1.1.1', doh: 'https://cloudflare-dns.com/dns-query', label: 'Cloudflare' },
  cloudflare_family: { ip: '1.1.1.3', doh: 'https://family.cloudflare-dns.com/dns-query', label: 'Cloudflare for Families' },
  adguard: { ip: '94.140.14.14', doh: 'https://dns.adguard-dns.com/dns-query', label: 'AdGuard DNS' },
  adguard_family: { ip: '94.140.14.15', doh: 'https://family.adguard-dns.com/dns-query', label: 'AdGuard DNS Family' },
};

/** Escolhe o resolvedor que cobre as categorias activas. */
export function pickResolver(categories: Record<ShieldCategory, boolean>): ResolverId {
  if (categories.ads && categories.adult) return 'adguard_family';
  if (categories.ads) return 'adguard';
  if (categories.adult) return 'cloudflare_family';
  return 'cloudflare';
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Perfil de configuração do iPhone/iPad (.mobileconfig) com DNS cifrado
 * (DNS-over-HTTPS) de filtragem. Instala-se pelo Safari ou pelo Ficheiros,
 * sem App Store. Num iPhone não supervisionado o utilizador pode removê-lo
 * em Definições → Geral → VPN e gestão de dispositivos.
 */
export function buildMobileConfig(params: { resolver: ResolverId | { doh: string; label: string }; profileUuid: string; payloadUuid: string; org?: string }): string {
  const r = typeof params.resolver === 'string' ? RESOLVERS[params.resolver] : params.resolver;
  const org = xml(params.org ?? 'offly');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key>
        <string>HTTPS</string>
        <key>ServerURL</key>
        <string>${xml(r.doh)}</string>
      </dict>
      <key>PayloadDescription</key>
      <string>Filtra sites através de DNS cifrado (${xml(r.label)}).</string>
      <key>PayloadDisplayName</key>
      <string>${org} — Proteção (${xml(r.label)})</string>
      <key>PayloadIdentifier</key>
      <string>app.offly.dns.${params.payloadUuid.toLowerCase()}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${params.payloadUuid.toUpperCase()}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Proteção de sites do ${org}. Pode removê-la em Definições → Geral → VPN e gestão de dispositivos.</string>
  <key>PayloadDisplayName</key>
  <string>${org} — Proteção</string>
  <key>PayloadIdentifier</key>
  <string>app.offly.profile.${params.profileUuid.toLowerCase()}</string>
  <key>PayloadOrganization</key>
  <string>${org}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${params.profileUuid.toUpperCase()}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;
}
