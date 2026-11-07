-- Faturação por gateway externo (sem loja de aplicações).
-- O gateway do cliente (ou uma automação: n8n, Make, Zapier, função própria)
-- envia eventos normalizados para a Edge Function `billing-webhook`, que
-- verifica a assinatura HMAC e chama `apply_billing_event`. Tudo idempotente.

alter table public.subscriptions drop constraint if exists subscriptions_store_check;
alter table public.subscriptions add constraint subscriptions_store_check check (store in ('google_play', 'app_store', 'external'));

alter table public.entitlements drop constraint if exists entitlements_entitlement_check;
alter table public.entitlements add constraint entitlements_entitlement_check
  check (entitlement in ('plus', 'premium', 'family', 'pro', 'pro_ai'));

-- Registo de eventos recebidos (idempotência + auditoria). Só o servidor escreve.
create table public.billing_events (
  id text primary key,                 -- id do evento no gateway
  provider text not null,
  type text not null,
  user_id uuid,                        -- sem FK: o registo financeiro mantém-se mesmo com id inválido
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
-- Sem políticas: apenas service_role (Edge Function) e funções security definer.

-- Produto → entitlements concedidos.
create or replace function public.product_entitlements(p_product text) returns text[]
language sql immutable as $$
  select case
    when p_product in ('offly_pro_monthly', 'offly_pro_yearly', 'offly_pro_lifetime') then array['pro']
    when p_product in ('offly_pro_ai_monthly', 'offly_pro_ai_yearly') then array['pro', 'pro_ai']
    when p_product = 'offly_family_yearly' then array['pro', 'family']
    else array[]::text[]
  end
$$;

/**
 * Aplica um evento normalizado. Devolve 'applied', 'duplicate' ou 'ignored'.
 * type: subscription.activated | subscription.renewed | subscription.updated |
 *       subscription.canceled | subscription.expired | payment.refunded | lifetime.purchased
 * «canceled» = renovação desligada: mantém acesso até ao fim do período pago.
 */
create or replace function public.apply_billing_event(
  p_event_id text, p_provider text, p_type text, p_user uuid, p_product text,
  p_subscription_ref text, p_period_end timestamptz, p_payload jsonb default '{}'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_sub uuid;
  v_ents text[] := public.product_entitlements(p_product);
  v_expires timestamptz;
  v_ent text;
begin
  insert into billing_events (id, provider, type, user_id, payload)
  values (p_event_id, p_provider, p_type, p_user, p_payload)
  on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;

  if p_user is null or not exists (select 1 from auth.users where id = p_user) or cardinality(v_ents) = 0 then
    return 'ignored';
  end if;

  v_status := case p_type
    when 'subscription.activated' then 'active'
    when 'subscription.renewed' then 'active'
    when 'subscription.updated' then 'active'
    when 'lifetime.purchased' then 'active'
    when 'subscription.canceled' then 'canceled'
    when 'subscription.expired' then 'expired'
    when 'payment.refunded' then 'refunded'
    else null end;
  if v_status is null then return 'ignored'; end if;

  insert into subscriptions (user_id, store, product_id, original_transaction_id, status, auto_renew, current_period_end)
  values (p_user, 'external', p_product, coalesce(p_subscription_ref, p_event_id), v_status,
          v_status = 'active' and p_type <> 'lifetime.purchased', p_period_end)
  on conflict (store, original_transaction_id) do update
    set status = excluded.status, product_id = excluded.product_id, auto_renew = excluded.auto_renew,
        current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end)
  returning id, current_period_end into v_sub, v_expires;

  if v_status in ('expired', 'refunded') then
    delete from entitlements where user_id = p_user and source_subscription_id = v_sub;
    return 'applied';
  end if;

  -- Vitalício não expira; subscrições valem até ao fim do período pago.
  if p_type = 'lifetime.purchased' then v_expires := null; end if;
  foreach v_ent in array v_ents loop
    insert into entitlements (user_id, entitlement, source_subscription_id, expires_at)
    values (p_user, v_ent, v_sub, v_expires)
    on conflict (user_id, entitlement) do update
      set source_subscription_id = excluded.source_subscription_id, expires_at = excluded.expires_at, updated_at = now()
      -- Não encurta um vitalício existente.
      where entitlements.expires_at is not null;
  end loop;
  return 'applied';
end $$;

revoke execute on function public.apply_billing_event(text, text, text, uuid, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_billing_event(text, text, text, uuid, text, text, timestamptz, jsonb) to service_role;

-- Estado do plano do próprio utilizador (para o app).
create or replace function public.my_entitlements() returns table (entitlement text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select entitlement, expires_at from entitlements
  where user_id = auth.uid() and (expires_at is null or expires_at > now())
$$;
revoke execute on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;
