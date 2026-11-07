// Lógica partilhada do webhook de faturação externa (testada em tests/functions).
// Sem dependências: usa Web Crypto (Deno e Node 20+).

export const EVENT_TYPES = [
  'subscription.activated',
  'subscription.renewed',
  'subscription.updated',
  'subscription.canceled',
  'subscription.expired',
  'payment.refunded',
  'lifetime.purchased',
] as const;
export type BillingEventType = (typeof EVENT_TYPES)[number];

export const PRODUCT_IDS = [
  'offly_pro_monthly',
  'offly_pro_yearly',
  'offly_pro_ai_monthly',
  'offly_pro_ai_yearly',
  'offly_family_yearly',
  'offly_pro_lifetime',
] as const;

/** Evento normalizado que o gateway (ou a automação) envia. */
export interface BillingEvent {
  id: string;
  type: BillingEventType;
  user_id: string;
  product_id: string;
  subscription_id?: string | null;
  current_period_end?: string | null;
  provider?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEvent(body: unknown): { ok: true; event: BillingEvent } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body_not_object' };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || b.id.length < 1 || b.id.length > 200) return { ok: false, error: 'invalid_id' };
  if (!EVENT_TYPES.includes(b.type as BillingEventType)) return { ok: false, error: 'invalid_type' };
  if (typeof b.user_id !== 'string' || !UUID.test(b.user_id)) return { ok: false, error: 'invalid_user_id' };
  if (!PRODUCT_IDS.includes(b.product_id as (typeof PRODUCT_IDS)[number])) return { ok: false, error: 'invalid_product_id' };
  if (b.current_period_end != null && (typeof b.current_period_end !== 'string' || Number.isNaN(Date.parse(b.current_period_end))))
    return { ok: false, error: 'invalid_current_period_end' };
  if (b.subscription_id != null && typeof b.subscription_id !== 'string') return { ok: false, error: 'invalid_subscription_id' };
  return {
    ok: true,
    event: {
      id: b.id,
      type: b.type as BillingEventType,
      user_id: b.user_id.toLowerCase(),
      product_id: b.product_id as string,
      subscription_id: (b.subscription_id as string | undefined) ?? null,
      current_period_end: (b.current_period_end as string | undefined) ?? null,
      provider: typeof b.provider === 'string' ? b.provider.slice(0, 50) : 'external',
    },
  };
}

const enc = new TextEncoder();

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (x) => x.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Cabeçalho `X-Offly-Signature: t=<unix segundos>,v1=<hex HMAC-SHA256 de "t.corpo">`.
 * Recusa assinaturas com mais de `toleranceSec` (protecção contra repetição).
 */
export async function verifySignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || Math.abs(nowSec - t) > toleranceSec) return false;
  return safeEqual(await hmacHex(secret, `${t}.${rawBody}`), v1.toLowerCase());
}
