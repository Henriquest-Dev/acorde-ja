// Edge Function: recebe eventos de pagamento do gateway externo do offly.
// Contrato e exemplos em docs/billing.md. Requer o segredo BILLING_WEBHOOK_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseEvent, verifySignature } from '../_shared/billing.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('BILLING_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'not_configured' }, 503);

  const raw = await req.text();
  if (raw.length > 64_000) return json({ error: 'too_large' }, 413);
  if (!(await verifySignature(req.headers.get('x-offly-signature'), raw, secret))) return json({ error: 'invalid_signature' }, 401);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = parseEvent(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const e = parsed.event;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('apply_billing_event', {
    p_event_id: e.id,
    p_provider: e.provider,
    p_type: e.type,
    p_user: e.user_id,
    p_product: e.product_id,
    p_subscription_ref: e.subscription_id,
    p_period_end: e.current_period_end,
    p_payload: body,
  });
  // 5xx faz o gateway repetir; o evento é idempotente pelo id.
  if (error) return json({ error: 'db_error' }, 500);
  return json({ result: data });
});
