// Edge Function (com JWT): o app pede uma subscrição PayPal e depois pede para a confirmar.
// Nada vindo do telemóvel desbloqueia acesso: o estado é sempre relido na API do PayPal.
//   { action: 'subscribe', productId }   -> { approveUrl, subscriptionId }
//   { action: 'confirm', subscriptionId } -> { result, entitlements }
//   { action: 'sync' }                    -> relê todas as subscrições PayPal da conta
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accessToken, decide, getSubscription, paypalApi, paypalEnvFromDeno, planByProduct, planById, planMatches, SUB_ID_RE } from '../_shared/paypal.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const env = paypalEnvFromDeno((k) => Deno.env.get(k));
  if (!env) return json({ error: 'not_configured' }, 503);
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  let token: string;
  try {
    token = await accessToken(env);
  } catch {
    return json({ error: 'paypal_unavailable' }, 502);
  }

  const sync = async (subscriptionId: string, source: string) => {
    const sub = await getSubscription(env, token, subscriptionId);
    if (!sub) return 'not_found';
    const plan = planById(sub.plan_id);
    const d = decide(sub, user.id);
    if (!plan || d.kind === 'none') return d.kind === 'none' ? d.reason : 'unknown_plan';
    const { data, error } = await admin.rpc('paypal_apply', {
      p_user: user.id,
      p_subscription: sub.id,
      p_product: plan.productId,
      p_status: d.kind === 'grant' ? d.status : d.status,
      p_period_end: d.kind === 'grant' ? d.periodEnd : null,
      p_payer: sub.subscriber?.payer_id ?? null,
      p_trial: d.kind === 'grant' && d.trial,
      p_event_id: `${source}:${sub.id}:${sub.status}:${sub.billing_info?.last_payment?.time ?? sub.start_time ?? ''}`,
      p_payload: { status: sub.status, plan_id: sub.plan_id, reason: d.reason },
    });
    if (error) throw error;
    return data as string;
  };

  const entitlements = async () => {
    const { data } = await admin.from('entitlements').select('entitlement, expires_at').eq('user_id', user.id);
    return (data ?? []).filter((e) => !e.expires_at || Date.parse(e.expires_at) > Date.now());
  };

  try {
    if (body.action === 'subscribe') {
      const plan = planByProduct(String(body.productId ?? ''));
      if (!plan) return json({ error: 'invalid_product' }, 400);

      // Membros de uma família não pagam: usa o plano do responsável.
      const { data: owner } = await admin.rpc('family_plan_owner', { p_user: user.id });
      if (owner) return json({ error: 'family_member' }, 409);

      // Não deixa pagar duas vezes o mesmo plano.
      const { data: active } = await admin
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('store', 'paypal')
        .eq('product_id', plan.productId)
        .eq('status', 'active')
        .gt('current_period_end', new Date().toISOString())
        .limit(1);
      if (active?.length) return json({ error: 'already_subscribed' }, 409);

      // Limite de tentativas: no máximo 10 checkouts por hora por conta.
      const { count } = await admin
        .from('paypal_checkouts')
        .select('subscription_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
      if ((count ?? 0) >= 10) return json({ error: 'rate_limited' }, 429);

      // Confirma no PayPal que o plano existe, está activo e tem o preço certo.
      if (!(await planMatches(env, token, plan))) return json({ error: 'plan_mismatch' }, 500);

      const back = `${url}/functions/v1/paypal-webhook?return=`;
      const created = await paypalApi<{ id?: string; links?: { rel: string; href: string }[] }>(
        env,
        token,
        'POST',
        '/v1/billing/subscriptions',
        {
          plan_id: plan.planId,
          custom_id: user.id,
          application_context: {
            brand_name: 'offly',
            locale: typeof body.locale === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(body.locale) ? body.locale : 'pt-BR',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            return_url: `${back}ok`,
            cancel_url: `${back}cancel`,
          },
        },
        { 'PayPal-Request-Id': crypto.randomUUID(), Prefer: 'return=minimal' },
      );
      const approve = created.data?.links?.find((l) => l.rel === 'approve')?.href;
      if (created.status >= 300 || !created.data?.id || !approve) return json({ error: 'paypal_create_failed' }, 502);
      await admin.from('paypal_checkouts').insert({ subscription_id: created.data.id, user_id: user.id, product_id: plan.productId });
      return json({ subscriptionId: created.data.id, approveUrl: approve });
    }

    if (body.action === 'confirm') {
      const id = String(body.subscriptionId ?? '');
      if (!SUB_ID_RE.test(id)) return json({ error: 'invalid_subscription' }, 400);
      // Só confirma subscrições criadas por esta conta.
      const { data: mine } = await admin.from('paypal_checkouts').select('subscription_id').eq('subscription_id', id).eq('user_id', user.id).maybeSingle();
      if (!mine) return json({ error: 'not_yours' }, 403);
      const result = await sync(id, 'confirm');
      return json({ result, entitlements: await entitlements() });
    }

    if (body.action === 'sync') {
      const { data: rows } = await admin
        .from('paypal_checkouts')
        .select('subscription_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const results: Record<string, string> = {};
      for (const r of rows ?? []) results[r.subscription_id] = await sync(r.subscription_id, 'sync');
      return json({ results, entitlements: await entitlements() });
    }

    return json({ error: 'invalid_action' }, 400);
  } catch (e) {
    console.error('paypal-checkout', e);
    return json({ error: 'internal' }, 500);
  }
});
