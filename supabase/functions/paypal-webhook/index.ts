// Edge Function (sem JWT): recebe os webhooks do PayPal e o regresso do checkout.
// - POST: assinatura verificada na API do PayPal; o estado da subscrição é relido
//   na API (o corpo do webhook nunca é usado como verdade).
// - GET ?return=ok|cancel: devolve o cliente ao app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accessToken, decide, getSubscription, paypalApi, paypalEnvFromDeno, planById, subscriptionIdFromEvent, verifyWebhook } from '../_shared/paypal.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const APP_RETURN = 'acordeja://settings/billing';

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === 'GET' && u.searchParams.has('return')) {
    const status = u.searchParams.get('return') === 'ok' ? 'ok' : 'cancel';
    const sub = (u.searchParams.get('subscription_id') ?? '').replace(/[^A-Z0-9-]/g, '').slice(0, 40);
    return new Response(null, { status: 302, headers: { Location: `${APP_RETURN}?paypal=${status}${sub ? `&subscription_id=${sub}` : ''}` } });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const env = paypalEnvFromDeno((k) => Deno.env.get(k));
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? '';
  if (!env || !webhookId) return json({ error: 'not_configured' }, 503);

  const raw = await req.text();
  if (raw.length > 200_000) return json({ error: 'too_large' }, 413);
  let event: { id?: string; event_type?: string; resource?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  let token: string;
  try {
    token = await accessToken(env);
  } catch {
    return json({ error: 'paypal_unavailable' }, 502); // o PayPal repete
  }

  // Verificação da assinatura feita pelo próprio PayPal.
  if (!(await verifyWebhook(env, token, webhookId, req.headers, event))) return json({ error: 'invalid_signature' }, 401);

  const { subscriptionId, refund } = subscriptionIdFromEvent(event);
  if (!subscriptionId) return json({ result: 'ignored' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const sub = await getSubscription(env, token, subscriptionId);
    if (!sub) return json({ result: 'ignored' });
    const plan = planById(sub.plan_id);
    if (!plan || !sub.custom_id) return json({ result: 'ignored' });

    // A conta offly é a que o servidor gravou ao criar o checkout (e tem de bater com o PayPal).
    const { data: checkout } = await admin.from('paypal_checkouts').select('user_id').eq('subscription_id', sub.id).maybeSingle();
    if (!checkout || checkout.user_id.toLowerCase() !== sub.custom_id.toLowerCase()) return json({ result: 'ignored' });
    const userId = checkout.user_id as string;
    const eventId = `paypal:${event.id ?? crypto.randomUUID()}`;

    if (refund) {
      // Reembolso ou estorno: retira o acesso e cancela a renovação no PayPal.
      const { data } = await admin.rpc('paypal_apply', {
        p_user: userId, p_subscription: sub.id, p_product: plan.productId, p_status: 'refunded', p_period_end: null,
        p_payer: sub.subscriber?.payer_id ?? null, p_trial: false, p_event_id: eventId, p_payload: event,
      });
      if (sub.status === 'ACTIVE' || sub.status === 'SUSPENDED') {
        await paypalApi(env, token, 'POST', `/v1/billing/subscriptions/${sub.id}/cancel`, { reason: 'Refunded' });
      }
      return json({ result: data });
    }

    const d = decide(sub, userId);
    if (d.kind === 'none') {
      await admin.from('billing_events').upsert({ id: eventId, provider: 'paypal', type: event.event_type ?? 'unknown', user_id: userId, payload: event });
      return json({ result: d.reason });
    }
    const { data, error } = await admin.rpc('paypal_apply', {
      p_user: userId,
      p_subscription: sub.id,
      p_product: plan.productId,
      p_status: d.status,
      p_period_end: d.kind === 'grant' ? d.periodEnd : null,
      p_payer: sub.subscriber?.payer_id ?? null,
      p_trial: d.kind === 'grant' && d.trial,
      p_event_id: eventId,
      p_payload: event,
    });
    if (error) throw error;
    return json({ result: data });
  } catch (e) {
    console.error('paypal-webhook', e);
    return json({ error: 'internal' }, 500); // o PayPal repete
  }
});
