// Edge Function: «coach» do offly.
//  - action "decide": decide um pedido de tempo extra (Parallel Decisions) com as regras fixas do offly por cima.
//  - action "speak":  devolve a frase em voz (Fish Audio), em MP3 base64.
// A chave OPENROUTER_API_KEY existe apenas nos segredos do Supabase. Exige sessão iniciada.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildDecisionRequest, decide, speechBody, speechText, type DecisionContext, type ExtraReason } from '../_shared/coach.ts';
import { orPost } from '../_shared/openrouter.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const REASONS: ExtraReason[] = ['work', 'study', 'communication', 'emergency', 'other'];
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  try {
    if (body.action === 'decide') {
      const ctx: DecisionContext = {
        app: String(body.app ?? 'esta app').slice(0, 40),
        reason: REASONS.includes(body.reason as ExtraReason) ? (body.reason as ExtraReason) : 'other',
        note: String(body.note ?? '').slice(0, 200),
        limitMinutes: body.limitMinutes == null ? null : num(body.limitMinutes, 0, 1440, 0),
        usedMinutes: body.usedMinutes == null ? null : num(body.usedMinutes, 0, 1440, 0),
        requestsToday: num(body.requestsToday, 0, 50, 0),
        hour: num(body.hour, 0, 23, 12),
        challengeActive: body.challengeActive === true,
        habitsDue: num(body.habitsDue, 0, 50, 0),
        habitsDone: num(body.habitsDone, 0, 50, 0),
        name: typeof body.name === 'string' ? body.name : null,
      };
      let modelAnswer: unknown = null;
      try {
        const res = await orPost('/api/alpha/decisions', buildDecisionRequest(ctx), 12_000);
        if (res.ok) modelAnswer = await res.json();
        else console.error('decisions_error', res.status, (await res.text()).slice(0, 200));
      } catch (e) {
        console.error('decisions_unreachable', e);
      }
      return json(decide(ctx, modelAnswer));
    }

    if (body.action === 'speak') {
      const text = speechText(String(body.text ?? ''));
      if (text.length < 2) return json({ error: 'empty_text' }, 400);
      const res = await orPost('/api/v1/audio/speech', speechBody(text), 30_000);
      if (res.status === 429) return json({ error: 'rate_limited' }, 429);
      if (!res.ok) {
        console.error('speech_error', res.status, (await res.text()).slice(0, 200));
        return json({ error: 'voice_unavailable' }, 502);
      }
      return json({ audio: toBase64(await res.arrayBuffer()), mime: 'audio/mpeg' });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('coach_error', e);
    return json({ error: 'internal' }, 500);
  }
});
