-- Testes de RLS e RPCs. Executados por scripts/test-db.sh contra um
-- PostgreSQL real com as migrações aplicadas. Qualquer falha aborta (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pt'),  -- encarregado
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pt'),  -- menor
  ('00000000-0000-0000-0000-00000000000c', 'c@test.pt'),  -- admin
  ('00000000-0000-0000-0000-00000000000d', 'd@test.pt');  -- estranho
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-00000000000c', 'owner');

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok — %', msg;
end $$;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  execute 'set role authenticated';
end $$;

-- 1. Perfil criado automaticamente pelo trigger
select pg_temp.assert((select count(*) from public.profiles) = 4, 'perfil criado no registo');

-- 2. Isolamento de limites entre utilizadores
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.app_limits (app_id, app_name, limit_minutes) values ('instagram', 'Instagram', 30);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.app_limits) = 0, 'D não vê limites de A');
update public.app_limits set limit_minutes = 1;
reset role;
select pg_temp.assert((select limit_minutes from public.app_limits where app_id = 'instagram') = 30, 'D não altera limites de A');

-- 3. Inserir em nome de outro utilizador é recusado
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  insert into public.app_limits (user_id, app_id, app_name, limit_minutes) values ('00000000-0000-0000-0000-00000000000a', 'x', 'X', 5);
  raise exception 'FALHOU: inserção em nome de outro foi aceite';
exception when insufficient_privilege then raise notice 'ok — inserção em nome de outro recusada';
end $$;
reset role;

-- 4. anon não lê dados de utilizadores; lê o catálogo
set role anon;
select pg_temp.assert((select count(*) from public.app_catalog) = 4, 'anon lê o catálogo');
do $$ begin
  perform * from public.usage_daily;
  raise exception 'FALHOU: anon leu usage_daily';
exception when insufficient_privilege then raise notice 'ok — anon sem acesso a usage_daily';
end $$;
reset role;

-- 5. Família: A cria, B junta-se, B regista utilização
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_family_group('Família Teste', 'Ana') as gid \gset
select pg_temp.assert((select count(*) from public.family_members) = 1, 'grupo criado com encarregado');
reset role;
select invite_code as code from public.family_groups where id = :'gid' \gset

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.join_family_group(:'code', 'Pedro', 2013::smallint);
insert into public.usage_daily (device_id, day, app_id, app_name, used_ms) values
  ('11111111-1111-1111-1111-111111111111', current_date, '__screen__', 'Tempo de ecrã', 5400000),
  ('11111111-1111-1111-1111-111111111111', current_date, 'instagram', 'Instagram', 1800000);
-- Idempotência: reenviar a mesma linha actualiza em vez de duplicar.
insert into public.usage_daily (device_id, day, app_id, app_name, used_ms) values
  ('11111111-1111-1111-1111-111111111111', current_date, 'instagram', 'Instagram', 1900000)
  on conflict (user_id, device_id, day, app_id) do update set used_ms = excluded.used_ms;
select pg_temp.assert((select count(*) from public.usage_daily) = 2, 'upsert idempotente sem duplicados');
select pg_temp.assert((select count(*) from public.family_usage_daily) = 0, 'menor não vê agregados de família');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.usage_daily) = 0, 'encarregado NÃO lê o detalhe por app do menor');
select pg_temp.assert((select total_ms from public.family_usage_daily) = 5400000, 'encarregado lê só o total diário agregado');
select pg_temp.assert((select count(*) from public.family_members) = 2, 'encarregado vê membros do grupo');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.family_usage_daily) = 0, 'estranho não vê agregados');
select pg_temp.assert((select count(*) from public.family_members) = 0, 'estranho não vê membros');
reset role;

-- 6. Pedido de tempo extra: menor pede, só o encarregado decide
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.request_extra_time('22222222-2222-2222-2222-222222222222', 'tiktok', 10, 'study');
do $$ begin
  perform public.decide_override_request('22222222-2222-2222-2222-222222222222', true);
  raise exception 'FALHOU: menor decidiu o próprio pedido';
exception when insufficient_privilege then raise notice 'ok — menor não decide o próprio pedido';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.override_requests where status = 'pending') = 1, 'encarregado vê pedido pendente');
select public.decide_override_request('22222222-2222-2222-2222-222222222222', true);
reset role;
select pg_temp.assert((select status from public.override_requests) = 'approved', 'pedido aprovado');

-- 7. Hábitos sensíveis: entradas só em hábitos próprios
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.habits (id, title, icon, frequency) values ('33333333-3333-3333-3333-333333333333', 'Ler', 'book-open', '{"kind":"daily"}');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  insert into public.habit_entries (id, habit_id, day) values (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', current_date);
  raise exception 'FALHOU: entrada em hábito alheio aceite';
exception when insufficient_privilege then raise notice 'ok — entrada em hábito alheio recusada';
end $$;
reset role;

-- 8. Administração: métricas agregadas sim; conversas e hábitos não
insert into public.ai_conversations (id, user_id) values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-00000000000b');
insert into public.ai_messages (conversation_id, user_id, role, content) values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-00000000000b', 'user', 'privado');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((public.admin_metrics() ->> 'users_total')::int = 4, 'admin lê métricas agregadas');
select pg_temp.assert((select count(*) from public.ai_messages) = 0, 'admin NÃO lê conversas privadas');
select pg_temp.assert((select count(*) from public.habits) = 0, 'admin NÃO lê hábitos');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  perform public.admin_metrics();
  raise exception 'FALHOU: não-admin leu métricas';
exception when insufficient_privilege then raise notice 'ok — não-admin sem métricas';
end $$;
reset role;

-- 9. Consentimentos são imutáveis para o utilizador
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.consent_records set granted = false;
delete from public.consent_records;
reset role;
select pg_temp.assert((select count(*) from public.consent_records where user_id = '00000000-0000-0000-0000-00000000000b' and granted) = 1, 'consentimento não pode ser alterado nem apagado');

-- 10. Parceiro de responsabilidade: aceitação explícita
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.accountability_links (invite_code, shared_goals) values ('PARC01', array['focus']);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.accept_accountability('parc01');
select pg_temp.assert((select status from public.accountability_links) = 'active', 'parceiro aceitou');
select pg_temp.assert((select count(*) from public.app_limits) = 0, 'parceiro não ganha acesso aos limites');
reset role;

-- 10b. Conta família: painel do responsável e limites geridos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.devices (id, platform, os_version, app_version) values ('55555555-5555-5555-5555-555555555555', 'android', '14', '0.3.0');
insert into public.focus_sessions (id, started_at, ended_at, planned_ms, actual_ms, status, mode) values
  ('66666666-6666-6666-6666-666666666666', now(), now(), 1500000, 1500000, 'completed', 'timer');
insert into public.block_events (id, app_id, kind, day) values ('77777777-7777-7777-7777-777777777777', 'instagram', 'blocked', current_date);
do $$ begin
  perform public.family_dashboard(7);
  raise exception 'FALHOU: membro abriu o painel do responsável';
exception when insufficient_privilege then raise notice 'ok — só o responsável abre o painel';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.family_dashboard(7) as dash \gset
select pg_temp.assert(jsonb_array_length((:'dash'::jsonb) -> 'members') = 1, 'painel mostra o telemóvel adicionado');
select pg_temp.assert(((:'dash'::jsonb) -> 'members' -> 0 -> 'devices' -> 0 ->> 'platform') = 'android', 'painel mostra o dispositivo');
select pg_temp.assert(jsonb_array_length((:'dash'::jsonb) -> 'members' -> 0 -> 'usage') = 2, 'painel mostra as apps usadas');
select pg_temp.assert(((:'dash'::jsonb) -> 'members' -> 0 -> 'focus' -> 0 ->> 'minutes')::int = 25, 'painel mostra o tempo de foco');
select pg_temp.assert(((:'dash'::jsonb) -> 'members' -> 0 -> 'blocks' -> 0 ->> 'count')::int = 1, 'painel mostra os bloqueios');
select public.family_set_member_limit((select id from public.family_members where role = 'member'), 'tiktok', 'TikTok', array['com.zhiliaoapp.musically'], 20, true);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.my_managed_limits()) = 1, 'membro recebe o limite definido pelo responsável');
update public.app_limits set limit_minutes = 600 where app_id = 'tiktok';
delete from public.app_limits where app_id = 'tiktok';
reset role;
select pg_temp.assert((select limit_minutes from public.app_limits where app_id = 'tiktok') = 20, 'membro não altera nem apaga o limite gerido');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  perform public.family_set_member_limit((select id from public.family_members limit 1), 'x', 'X', '{}', 5, true);
  raise exception 'FALHOU: estranho definiu limite';
exception when insufficient_privilege then raise notice 'ok — estranho não define limites';
end $$;
reset role;

-- 10c. Conta família partilhada: o membro usa o plano do responsável e não pode comprar
insert into public.entitlements (user_id, entitlement, expires_at) values ('00000000-0000-0000-0000-00000000000a', 'family', now() + interval '30 days');
select pg_temp.assert(public.has_entitlement('00000000-0000-0000-0000-00000000000b', 'family'), 'membro herda o plano do responsável');
select pg_temp.assert(not public.has_entitlement('00000000-0000-0000-0000-00000000000d', 'family'), 'estranho não herda o plano');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.my_plan() as plan_b \gset
select pg_temp.assert(((:'plan_b'::jsonb) ->> 'can_purchase')::boolean = false, 'membro da família não pode comprar');
select pg_temp.assert(((:'plan_b'::jsonb) ->> 'family_member')::boolean, 'app sabe que é membro da família');
select pg_temp.assert((:'plan_b'::jsonb) -> 'entitlements' ? 'family', 'membro vê o plano partilhado');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.my_plan() as plan_a \gset
select pg_temp.assert(((:'plan_a'::jsonb) ->> 'can_purchase')::boolean, 'responsável pode comprar');
reset role;
delete from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000a';

-- 11. Saída do encarregado elimina o grupo (sem menores sob controlo órfão)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.leave_family_group();
reset role;
select pg_temp.assert((select count(*) from public.family_groups) = 0, 'grupo sem encarregado é eliminado');

-- 11b. Faturação externa: idempotente, só o servidor aplica eventos
do $$ begin
  set local role authenticated;
  perform public.apply_billing_event('e0', 'x', 'subscription.activated', '00000000-0000-0000-0000-00000000000d', 'offly_pro_monthly', 's0', now() + interval '30 days');
  raise exception 'FALHOU: utilizador aplicou evento de faturação';
exception when insufficient_privilege then raise notice 'ok — utilizador não aplica eventos de faturação';
end $$;
reset role;
select pg_temp.assert(public.apply_billing_event('e1', 'gw', 'subscription.activated', '00000000-0000-0000-0000-00000000000d', 'offly_pro_ai_monthly', 'sub_1', now() + interval '30 days') = 'applied', 'evento aplicado');
select pg_temp.assert(public.apply_billing_event('e1', 'gw', 'subscription.activated', '00000000-0000-0000-0000-00000000000d', 'offly_pro_ai_monthly', 'sub_1', now() + interval '30 days') = 'duplicate', 'evento repetido é ignorado');
select pg_temp.assert((select count(*) from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000d') = 2, 'Pro + IA concede pro e pro_ai');
select pg_temp.assert(public.apply_billing_event('e2', 'gw', 'subscription.activated', '00000000-0000-0000-0000-0000000000ff', 'offly_pro_monthly', 'sub_2', null) = 'ignored', 'utilizador inexistente é ignorado');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.my_entitlements()) = 2, 'utilizador vê o próprio plano');
do $$ begin
  perform * from public.billing_events;
  raise exception 'FALHOU: utilizador leu billing_events';
exception when insufficient_privilege then raise notice 'ok — billing_events só no servidor';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.my_entitlements()) = 0, 'A não vê o plano de D');
reset role;
select pg_temp.assert(public.apply_billing_event('e3', 'gw', 'payment.refunded', '00000000-0000-0000-0000-00000000000d', 'offly_pro_ai_monthly', 'sub_1', null) = 'applied', 'reembolso aplicado');
select pg_temp.assert((select count(*) from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000d') = 0, 'reembolso retira o acesso');
select pg_temp.assert(public.apply_billing_event('e4', 'gw', 'lifetime.purchased', '00000000-0000-0000-0000-00000000000d', 'offly_pro_lifetime', 'ord_9', null) = 'applied', 'vitalício aplicado');
select pg_temp.assert((select expires_at is null from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000d' and entitlement = 'pro'), 'vitalício não expira');

-- 12. Conta eliminada: todos os dados em cascata
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.assert((select count(*) from public.usage_daily) = 0 and (select count(*) from public.habits) = 0
  and (select count(*) from public.ai_messages) = 0 and (select count(*) from public.consent_records where user_id = '00000000-0000-0000-0000-00000000000b') = 0,
  'eliminação de conta remove os dados em cascata');

-- 13. Retenção
insert into public.notifications (user_id, kind, title, body, sent_at) values ('00000000-0000-0000-0000-00000000000a', 'x', 't', 'b', now() - interval '200 days');
select public.purge_expired_data();
select pg_temp.assert((select count(*) from public.notifications) = 0, 'retenção remove notificações antigas');

\echo 'Todos os testes de RLS passaram.'
