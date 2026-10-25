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

-- 11. Saída do encarregado elimina o grupo (sem menores sob controlo órfão)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.leave_family_group();
reset role;
select pg_temp.assert((select count(*) from public.family_groups) = 0, 'grupo sem encarregado é eliminado');

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
