-- Vistas agregadas, RPCs de família/responsabilidade e retenção de dados.

-- Encarregados vêem APENAS o total diário de tempo de ecrã dos membros
-- activos do grupo (linha '__screen__'), nunca o detalhe por aplicação.
create or replace view public.family_usage_daily
with (security_barrier = true) as
select fm.group_id, fm.id as member_id, u.day, sum(u.used_ms)::bigint as total_ms
from public.usage_daily u
join public.family_members fm on fm.user_id = u.user_id and fm.status = 'active' and fm.role = 'member'
where u.app_id = '__screen__'
  and public.is_group_guardian(fm.group_id)
group by fm.group_id, fm.id, u.day;

revoke all on public.family_usage_daily from anon;
grant select on public.family_usage_daily to authenticated;

create or replace function public.generate_invite_code() returns text
language sql volatile as $$
  -- Sem caracteres ambíguos (0/O, 1/I).
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public.create_family_group(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from family_members where user_id = auth.uid() and status = 'active') then
    raise exception 'already_in_group' using errcode = 'P0001';
  end if;
  insert into family_groups (name, invite_code, created_by)
  values (p_name, generate_invite_code(), auth.uid()) returning id into g;
  insert into family_members (group_id, user_id, display_name, role) values (g, auth.uid(), p_display_name, 'guardian');
  insert into consent_records (user_id, purpose, granted, policy_version) values (auth.uid(), 'family', true, '2026-10');
  insert into audit_logs (actor_id, action, target_table, target_id) values (auth.uid(), 'family.create', 'family_groups', g::text);
  return g;
end $$;

create or replace function public.join_family_group(p_code text, p_display_name text, p_birth_year smallint default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select id into g from family_groups where invite_code = upper(p_code);
  if g is null then raise exception 'invalid_code' using errcode = 'P0002'; end if;
  if exists (select 1 from family_members where user_id = auth.uid() and status = 'active') then
    raise exception 'already_in_group' using errcode = 'P0001';
  end if;
  insert into family_members (group_id, user_id, display_name, role, birth_year)
  values (g, auth.uid(), p_display_name, 'member', p_birth_year);
  -- Aceitação explícita registada: o membro sabe que o total diário é partilhado.
  insert into consent_records (user_id, purpose, granted, policy_version) values (auth.uid(), 'family', true, '2026-10');
  insert into audit_logs (actor_id, action, target_table, target_id) values (auth.uid(), 'family.join', 'family_groups', g::text);
  return g;
end $$;

create or replace function public.leave_family_group() returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from family_members where user_id = auth.uid() and status = 'active';
  if m is null then return; end if;
  delete from family_members where id = m.id;
  -- Um grupo sem encarregados é eliminado (evita menores "órfãos" sob controlo).
  if m.role = 'guardian' and not exists (select 1 from family_members where group_id = m.group_id and role = 'guardian') then
    delete from family_groups where id = m.group_id;
  end if;
  insert into consent_records (user_id, purpose, granted, policy_version) values (auth.uid(), 'family', false, '2026-10');
  insert into audit_logs (actor_id, action, target_table, target_id) values (auth.uid(), 'family.leave', 'family_groups', m.group_id::text);
end $$;

-- Pedido de tempo extra de um membro ao encarregado.
create or replace function public.request_extra_time(p_id uuid, p_app_id text, p_extra int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from family_members where user_id = auth.uid() and status = 'active' and role = 'member';
  if m is null then raise exception 'not_family_member' using errcode = 'P0003'; end if;
  insert into override_requests (id, user_id, group_id, member_id, app_id, day, extra_minutes, reason, status)
  values (p_id, auth.uid(), m.group_id, m.id, p_app_id, current_date, p_extra, p_reason, 'pending')
  on conflict (id) do nothing;
end $$;

create or replace function public.decide_override_request(p_request_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from override_requests where id = p_request_id for update;
  if r is null or r.group_id is null or not is_group_guardian(r.group_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.status <> 'pending' then raise exception 'already_decided' using errcode = 'P0004'; end if;
  update override_requests
    set status = case when p_approve then 'approved' else 'denied' end, decided_by = auth.uid(), decided_at = now()
    where id = p_request_id;
  insert into audit_logs (actor_id, action, target_table, target_id, meta)
  values (auth.uid(), 'override.decide', 'override_requests', p_request_id::text, jsonb_build_object('approved', p_approve));
end $$;

-- Parceiro de responsabilidade: aceitação explícita com código.
create or replace function public.accept_accountability(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select * into l from accountability_links where invite_code = upper(p_code) and status = 'pending' for update;
  if l is null then raise exception 'invalid_code' using errcode = 'P0002'; end if;
  if l.owner_id = auth.uid() then raise exception 'own_link' using errcode = 'P0005'; end if;
  update accountability_links set partner_id = auth.uid(), status = 'active', accepted_at = now() where id = l.id;
  insert into consent_records (user_id, purpose, granted, policy_version) values (auth.uid(), 'accountability', true, '2026-10');
  return l.id;
end $$;

create or replace function public.revoke_accountability(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update accountability_links set status = 'revoked', revoked_at = now()
  where id = p_id and (owner_id = auth.uid() or partner_id = auth.uid());
end $$;

-- Entitlement activo (usado pelas Edge Functions e pelo aplicativo).
create or replace function public.has_entitlement(p_user uuid, p_entitlement text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entitlements
    where user_id = p_user and entitlement = p_entitlement and (expires_at is null or expires_at > now())
  );
$$;

-- Métricas agregadas para o painel administrativo (sem dados individuais).
create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_7d', (select count(distinct user_id) from devices where last_seen_at > now() - interval '7 days'),
    'paid_active', (select count(distinct user_id) from entitlements where expires_at is null or expires_at > now()),
    'subscriptions_canceled_30d', (select count(*) from subscriptions where status in ('canceled', 'expired') and updated_at > now() - interval '30 days'),
    'tickets_open', (select count(*) from support_tickets where status <> 'closed'),
    'ai_messages_7d', (select count(*) from ai_messages where created_at > now() - interval '7 days' and role = 'assistant'),
    'ai_output_tokens_7d', (select coalesce(sum(output_tokens), 0) from ai_messages where created_at > now() - interval '7 days'),
    'ai_input_tokens_7d', (select coalesce(sum(input_tokens), 0) from ai_messages where created_at > now() - interval '7 days'),
    'service_errors_7d', (select count(*) from block_events where kind = 'service_error' and created_at > now() - interval '7 days')
  );
end $$;

-- Retenção: elimina dados que já não são necessários.
create or replace function public.purge_expired_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from ai_messages where created_at < now() - interval '90 days';
  delete from ai_conversations c where last_message_at < now() - interval '90 days'
    and not exists (select 1 from ai_messages m where m.conversation_id = c.id);
  delete from usage_daily where day < current_date - interval '13 months';
  delete from block_events where day < current_date - interval '13 months';
  delete from notifications where sent_at < now() - interval '90 days';
  delete from audit_logs where created_at < now() - interval '2 years';
end $$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
revoke execute on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;
revoke execute on function public.has_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.create_family_group(text, text), public.join_family_group(text, text, smallint),
  public.leave_family_group(), public.request_extra_time(uuid, text, int, text), public.decide_override_request(uuid, boolean),
  public.accept_accountability(text), public.revoke_accountability(uuid) to authenticated;

-- Agendamento diário da retenção quando o pg_cron está disponível (Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('acorde-purge-expired', '17 3 * * *', 'select public.purge_expired_data()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível: agendar purge_expired_data() externamente (%).', sqlerrm;
end $$;
