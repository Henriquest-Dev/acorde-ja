// Edge Function: assistente Acorde Já.
// - A chave ANTHROPIC_API_KEY existe apenas nos segredos do Supabase.
// - Autentica o utilizador pelo JWT, aplica limite diário e (opcional) entitlement.
// - Detecta sinais de crise antes de chamar o modelo.
// - Guarda apenas a conversa do próprio utilizador (retenção de 90 dias).
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CRISIS_REPLY, SYSTEM_PROMPT, buildContextNote, detectCrisis, extractCards } from '../_shared/safety.ts';

const MODEL = 'claude-opus-5-5';
const DAILY_MESSAGE_LIMIT = Number(Deno.env.get('AI_DAILY_MESSAGE_LIMIT') ?? '40');
const HISTORY_TURNS = 12;
const REQUIRE_ENTITLEMENT = Deno.env.get('AI_REQUIRE_ENTITLEMENT') === 'true';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { conversationId?: string | null; message?: string; context?: Parameters<typeof buildContextNote>[0] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const message = String(body.message ?? '').trim().slice(0, 2000);
  if (!message) return json({ error: 'empty_message' }, 400);
  const conversationId = typeof body.conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(body.conversationId) ? body.conversationId : crypto.randomUUID();

  if (REQUIRE_ENTITLEMENT) {
    const { data: ent } = await admin.rpc('has_entitlement', { p_user: user.id, p_entitlement: 'premium' });
    if (!ent) return json({ error: 'premium_required' }, 402);
  }

  // Controlo de custos: limite diário de mensagens por utilizador.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from('ai_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) return json({ error: 'rate_limited' }, 429);

  await admin.from('ai_conversations').upsert({ id: conversationId, user_id: user.id, last_message_at: new Date().toISOString() });
  const crisis = detectCrisis(message);
  await admin.from('ai_messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content: message, flagged_crisis: crisis });

  if (crisis) {
    await admin.from('ai_messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content: CRISIS_REPLY, flagged_crisis: true });
    return json({ reply: CRISIS_REPLY, conversationId, cards: ['help'], crisis: true });
  }

  const { data: history } = await admin
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);
  const messages: Anthropic.Beta.BetaMessageParam[] = (history ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));
  // A conversa tem de começar no utilizador.
  while (messages.length && messages[0]!.role !== 'user') messages.shift();

  try {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Conversa curta: esforço baixo controla custo e latência.
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Prompt de sistema estável e cacheado; o contexto variável vai numa mensagem de sistema no fim.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      // Mensagem de sistema a meio da conversa: não invalida o prefixo em cache.
      messages: [...messages, { role: 'system', content: buildContextNote(body.context) }],
    });
    if (res.stop_reason === 'refusal') {
      const fallbackText = 'Não consigo ajudar com isso. Se precisares de apoio imediato, experimenta o exercício de respiração ou fala com alguém de confiança.';
      await admin.from('ai_messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content: fallbackText });
      return json({ reply: fallbackText, conversationId, cards: ['breathing'], crisis: false });
    }
    const raw = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const { text, cards } = extractCards(raw);
    await admin.from('ai_messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'assistant',
      content: text.slice(0, 8000),
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
    });
    return json({ reply: text, conversationId, cards, crisis: false });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic_error', e.status, e.message);
      return json({ error: 'model_unavailable' }, 502);
    }
    console.error('assistant_error', e);
    return json({ error: 'internal' }, 500);
  }
});
