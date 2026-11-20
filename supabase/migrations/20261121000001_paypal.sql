-- PayPal Subscriptions. Só as Edge Functions (service_role) escrevem aqui.
-- O estado vem sempre da API do PayPal; ver supabase/functions/_shared/paypal.ts.

alter table public.subscriptions drop constraint if exists subscriptions_store_check;
alter table public.subscriptions add constraint subscriptions_store_check
  check (store in ('google_play', 'app_store', 'external', 'paypal'));

-- Cada subscrição criada pelo app, ligada à conta que a pediu.
create table if not exists public.paypal_checkouts (
  subscription_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists paypal_checkouts_user on public.paypal_checkouts (user_id, created_at desc);
alter table public.paypal_checkouts enable row level security;

-- Um só teste grátis por conta PayPal (payer_id), mesmo com várias contas offly.
create table if not exists public.paypal_trials (
  payer_id text primary key,
  subscription_id text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
alter table public.paypal_trials enable row level security;

/**
 * Aplica o estado verificado de uma subscrição PayPal.
 * p_status: 'active' | 'canceled' (acesso até p_period_end) | 'expired' | 'refunded' (retira o acesso).
 * Devolve: applied | revoked | user_mismatch | refunded_locked | trial_reused | ignored.
 */
create or replace function public.paypal_apply(
  p_user uuid, p_subscription text, p_product text, p_status text, p_period_end timestamptz,
  p_payer text, p_trial boolean, p_event_id text, p_payload jsonb default '{}'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_existing subscriptions%rowtype;
  v_ents text[] := public.product_entitlements(p_product);
  v_sub uuid;
  v_ent text;
  v_trial_sub text;
begin
  if p_event_id is not null then
    insert into billing_events (id, provider, type, user_id, payload)
    values (p_event_id, 'paypal', p_status, p_user, coalesce(p_payload, '{}'::jsonb))
    on conflict (id) do nothing;
  end if;

  if p_user is null or not exists (select 1 from auth.users where id = p_user) or cardinality(v_ents) = 0
     or p_status not in ('active', 'canceled', 'expired', 'refunded') then
    return 'ignored';
  end if;

  -- Serializa por subscrição (webhook e app podem chegar ao mesmo tempo).
  perform pg_advisory_xact_lock(hashtext('paypal:' || p_subscription));

  select * into v_existing from subscriptions where store = 'paypal' and original_transaction_id = p_subscription;
  if found and v_existing.user_id <> p_user then return 'user_mismatch'; end if;
  -- Reembolso/estorno é definitivo para esta subscrição.
  if found and v_existing.status = 'refunded' and p_status <> 'refunded' then return 'refunded_locked'; end if;

  if p_trial and p_status in ('active', 'canceled') then
    if p_payer is null or p_payer = '' then return 'trial_reused'; end if;
    insert into paypal_trials (payer_id, subscription_id, user_id) values (p_payer, p_subscription, p_user)
    on conflict (payer_id) do nothing;
    select subscription_id into v_trial_sub from paypal_trials where payer_id = p_payer;
    if v_trial_sub <> p_subscription then return 'trial_reused'; end if;
  end if;

  insert into subscriptions (user_id, store, product_id, original_transaction_id, status, auto_renew, current_period_end, updated_at)
  values (p_user, 'paypal', p_product, p_subscription, p_status, p_status = 'active', p_period_end, now())
  on conflict (store, original_transaction_id) do update
    set status = excluded.status, product_id = excluded.product_id, auto_renew = excluded.auto_renew,
        current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end), updated_at = now()
  returning id into v_sub;

  if p_status in ('expired', 'refunded') or p_period_end is null or p_period_end <= now() then
    delete from entitlements where user_id = p_user and source_subscription_id = v_sub;
    return 'revoked';
  end if;

  foreach v_ent in array v_ents loop
    insert into entitlements (user_id, entitlement, source_subscription_id, expires_at)
    values (p_user, v_ent, v_sub, p_period_end)
    on conflict (user_id, entitlement) do update
      set source_subscription_id = excluded.source_subscription_id, expires_at = excluded.expires_at, updated_at = now()
      -- Nunca encurta um vitalício nem um acesso mais longo vindo de outra subscrição activa.
      where entitlements.expires_at is not null
        and (entitlements.source_subscription_id = excluded.source_subscription_id
             or entitlements.source_subscription_id is null
             or entitlements.expires_at < excluded.expires_at);
  end loop;
  return 'applied';
end $$;

revoke execute on function public.paypal_apply(uuid, text, text, text, timestamptz, text, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.paypal_apply(uuid, text, text, text, timestamptz, text, boolean, text, jsonb) to service_role;

-- Garantias explícitas para o servidor (Edge Functions).
grant execute on function public.family_plan_owner(uuid) to service_role;
grant execute on function public.has_entitlement(uuid, text) to service_role;
grant select, insert on public.paypal_checkouts to service_role;
grant select, insert on public.paypal_trials to service_role;
