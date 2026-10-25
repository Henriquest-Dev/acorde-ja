// Edge Function: eliminação de conta pelo próprio utilizador.
// Apaga o utilizador em auth.users; todas as tabelas têm ON DELETE CASCADE.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data } = await admin.auth.getUser(jwt ?? '');
  if (!data.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });

  // Registo de auditoria sem dados pessoais (o actor deixa de existir; guarda-se só o evento).
  await admin.from('audit_logs').insert({ actor_id: null, action: 'account.delete', target_table: 'auth.users' });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
});
