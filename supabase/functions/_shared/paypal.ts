// PayPal Subscriptions: regras anti-fraude partilhadas pelas Edge Functions
// `paypal-checkout` e `paypal-webhook` (testadas em tests/functions/paypal.test.ts).
//
// Princípio: nada que venha do telemóvel ou do corpo de um webhook é confiado.
// O estado de cada subscrição é sempre relido na API do PayPal com as credenciais
// do servidor, e o acesso só cobre o período que foi efectivamente pago
// (ou o teste grátis, uma vez por conta PayPal).

export type ProductId =
  | 'offly_pro_monthly'
  | 'offly_pro_yearly'
  | 'offly_pro_ai_monthly'
  | 'offly_pro_ai_yearly'
  | 'offly_family_yearly';

export interface PlanSpec {
  planId: string;
  productId: ProductId;
  price: string;
  interval: 'MONTH' | 'YEAR';
  trialDays: number;
}

/** Planos activos na conta PayPal do offly (criados em paypal.com/billing/plans). */
export const PAYPAL_PLANS: PlanSpec[] = [
  { planId: 'P-01H46333R3479363TNMAMXYQ', productId: 'offly_pro_monthly', price: '3.99', interval: 'MONTH', trialDays: 0 },
  { planId: 'P-7PX88878M8529714NNMAMZUQ', productId: 'offly_pro_yearly', price: '24.99', interval: 'YEAR', trialDays: 7 },
  { planId: 'P-8YJ21466RL665652MNMAM2SQ', productId: 'offly_pro_ai_monthly', price: '6.99', interval: 'MONTH', trialDays: 0 },
  { planId: 'P-0Y143158873528411NMAM3QY', productId: 'offly_pro_ai_yearly', price: '44.99', interval: 'YEAR', trialDays: 7 },
  { planId: 'P-1LR23218WD9898613NMAM4HQ', productId: 'offly_family_yearly', price: '49.99', interval: 'YEAR', trialDays: 0 },
];

export const planByProduct = (p: string) => PAYPAL_PLANS.find((x) => x.productId === p) ?? null;
export const planById = (id: string) => PAYPAL_PLANS.find((x) => x.planId === id) ?? null;

/** Dias de tolerância depois da data de cobrança (o PayPal tenta cobrar de novo). */
export const GRACE_DAYS = 3;
const DAY = 86_400_000;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SUB_ID_RE = /^I-[A-Z0-9]{6,40}$/;

/** Subconjunto do recurso `GET /v1/billing/subscriptions/{id}` que usamos. */
export interface PaypalSubscription {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  start_time?: string;
  subscriber?: { payer_id?: string };
  billing_info?: {
    outstanding_balance?: { value?: string };
    cycle_executions?: { tenure_type: string; cycles_completed?: number }[];
    last_payment?: { amount?: { value?: string; currency_code?: string }; time?: string };
    next_billing_time?: string;
    failed_payments_count?: number;
  };
}

export type Decision =
  | { kind: 'none'; reason: string }
  | { kind: 'revoke'; status: 'expired'; reason: string }
  | { kind: 'grant'; status: 'active' | 'canceled'; periodEnd: string; trial: boolean; reason: string };

const addInterval = (ms: number, interval: 'MONTH' | 'YEAR') => {
  const d = new Date(ms);
  if (interval === 'MONTH') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime();
};

const money = (v?: string) => {
  const n = Number(v ?? '0');
  return Number.isFinite(n) ? n : 0;
};

/**
 * Decide o acesso a partir do estado real da subscrição no PayPal.
 * - Só ACTIVE ou CANCELLED dão acesso, e só até ao fim do que foi pago.
 * - O último pagamento tem de ser pelo menos o preço do plano, em USD.
 * - Sem pagamento, só o teste grátis do plano anual (no máximo trialDays + 1).
 */
export function decide(sub: PaypalSubscription, expectedUser: string | null, now = Date.now()): Decision {
  const plan = planById(sub.plan_id);
  if (!plan) return { kind: 'none', reason: 'unknown_plan' };
  if (!sub.custom_id || !UUID_RE.test(sub.custom_id)) return { kind: 'none', reason: 'no_custom_id' };
  if (expectedUser && sub.custom_id.toLowerCase() !== expectedUser.toLowerCase()) return { kind: 'none', reason: 'user_mismatch' };

  if (sub.status === 'SUSPENDED' || sub.status === 'EXPIRED') return { kind: 'revoke', status: 'expired', reason: sub.status.toLowerCase() };
  if (sub.status !== 'ACTIVE' && sub.status !== 'CANCELLED') return { kind: 'none', reason: `status_${sub.status.toLowerCase()}` };

  const bi = sub.billing_info ?? {};
  const last = bi.last_payment;
  const lastTime = last?.time ? Date.parse(last.time) : NaN;
  const paidOk =
    !!last && money(last.amount?.value) + 0.001 >= Number(plan.price) && (last.amount?.currency_code ?? 'USD') === 'USD' && Number.isFinite(lastTime);

  let end: number;
  let trial = false;
  if (paidOk) {
    end = addInterval(lastTime, plan.interval) + GRACE_DAYS * DAY;
  } else {
    const regularDone = (bi.cycle_executions ?? []).find((c) => c.tenure_type === 'REGULAR')?.cycles_completed ?? 0;
    const start = sub.start_time ? Date.parse(sub.start_time) : NaN;
    if (plan.trialDays <= 0 || regularDone > 0 || !Number.isFinite(start)) return { kind: 'none', reason: 'not_paid' };
    trial = true;
    end = start + (plan.trialDays + 1) * DAY;
    const next = bi.next_billing_time ? Date.parse(bi.next_billing_time) : NaN;
    if (Number.isFinite(next)) end = Math.min(end, next);
  }
  if (end <= now) return { kind: 'revoke', status: 'expired', reason: trial ? 'trial_over' : 'period_over' };
  return {
    kind: 'grant',
    status: sub.status === 'CANCELLED' ? 'canceled' : 'active',
    periodEnd: new Date(end).toISOString(),
    trial,
    reason: trial ? 'trial' : 'paid',
  };
}

/** Eventos de webhook que interessam e onde está o id da subscrição. */
export function subscriptionIdFromEvent(ev: { event_type?: string; resource?: Record<string, unknown> }): {
  subscriptionId: string | null;
  refund: boolean;
} {
  const t = ev.event_type ?? '';
  const r = ev.resource ?? {};
  if (t.startsWith('BILLING.SUBSCRIPTION.')) return { subscriptionId: typeof r.id === 'string' ? r.id : null, refund: false };
  if (t.startsWith('PAYMENT.SALE.')) {
    const id = typeof r.billing_agreement_id === 'string' ? r.billing_agreement_id : null;
    return { subscriptionId: id, refund: t === 'PAYMENT.SALE.REFUNDED' || t === 'PAYMENT.SALE.REVERSED' };
  }
  return { subscriptionId: null, refund: false };
}

// ---------- Cliente da API (fetch injectável para testes) ----------

export interface PaypalEnv {
  clientId: string;
  secret: string;
  base?: string;
  fetch?: typeof fetch;
}

const apiBase = (env: PaypalEnv) => env.base ?? 'https://api-m.paypal.com';

export async function accessToken(env: PaypalEnv): Promise<string> {
  const f = env.fetch ?? fetch;
  const res = await f(`${apiBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.clientId}:${env.secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`paypal_token_${res.status}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('paypal_token_missing');
  return j.access_token;
}

export async function paypalApi<T>(env: PaypalEnv, token: string, method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; data: T | null }> {
  const f = env.fetch ?? fetch;
  const res = await f(`${apiBase(env)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

export async function getSubscription(env: PaypalEnv, token: string, id: string): Promise<PaypalSubscription | null> {
  if (!SUB_ID_RE.test(id)) return null;
  const r = await paypalApi<PaypalSubscription>(env, token, 'GET', `/v1/billing/subscriptions/${id}`);
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.data) throw new Error(`paypal_get_${r.status}`);
  return r.data;
}

/** Confirma no PayPal que o plano tem o preço e a periodicidade esperados. */
export async function planMatches(env: PaypalEnv, token: string, spec: PlanSpec): Promise<boolean> {
  type Plan = {
    status?: string;
    billing_cycles?: { tenure_type: string; frequency?: { interval_unit?: string; interval_count?: number }; pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } } }[];
  };
  const r = await paypalApi<Plan>(env, token, 'GET', `/v1/billing/plans/${spec.planId}`);
  if (r.status !== 200 || !r.data || r.data.status !== 'ACTIVE') return false;
  const regular = r.data.billing_cycles?.find((c) => c.tenure_type === 'REGULAR');
  const price = regular?.pricing_scheme?.fixed_price;
  return (
    !!regular &&
    regular.frequency?.interval_unit === spec.interval &&
    (regular.frequency?.interval_count ?? 1) === 1 &&
    Math.abs(money(price?.value) - Number(spec.price)) < 0.001 &&
    price?.currency_code === 'USD'
  );
}

/** Verifica a assinatura de um webhook na própria API do PayPal. */
export async function verifyWebhook(env: PaypalEnv, token: string, webhookId: string, headers: Headers, event: unknown): Promise<boolean> {
  const h = (k: string) => headers.get(k) ?? '';
  if (!webhookId || !h('paypal-transmission-id') || !h('paypal-transmission-sig')) return false;
  const r = await paypalApi<{ verification_status?: string }>(env, token, 'POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: event,
  });
  return r.status === 200 && r.data?.verification_status === 'SUCCESS';
}

export function paypalEnvFromDeno(get: (k: string) => string | undefined): PaypalEnv | null {
  const clientId = get('PAYPAL_CLIENT_ID');
  const secret = get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !secret) return null;
  return { clientId, secret, base: get('PAYPAL_API_BASE') || undefined };
}
