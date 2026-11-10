-- Conta família partilhada: quem é adicionado a um grupo (membro) usa o plano do responsável
-- e não pode comprar nem gerir pagamentos. Só o responsável paga.

/** Responsável (encarregado) do grupo onde o utilizador é membro activo; null se não for membro. */
create or replace function public.family_plan_owner(p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select g.user_id
  from family_members m
  join family_members g on g.group_id = m.group_id and g.role = 'guardian' and g.status = 'active'
  where m.user_id = p_user and m.role = 'member' and m.status = 'active'
  limit 1
$$;

/** Direitos do utilizador: os próprios mais os do responsável da família (se for membro). */
create or replace function public.has_entitlement(p_user uuid, p_entitlement text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entitlements
    where user_id in (p_user, public.family_plan_owner(p_user))
      and entitlement = p_entitlement and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.my_entitlements() returns table (entitlement text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select entitlement, max(expires_at) from entitlements
  where user_id in (auth.uid(), public.family_plan_owner(auth.uid())) and (expires_at is null or expires_at > now())
  group by entitlement
$$;

/** Resumo do plano para o app: se é membro de uma família, quem paga e se pode comprar. */
create or replace function public.my_plan() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'family_member', o.owner is not null,
    'can_purchase', o.owner is null,
    'paid_by', (select g.display_name from family_members m
                join family_members g on g.group_id = m.group_id and g.role = 'guardian' and g.status = 'active'
                where m.user_id = auth.uid() and m.role = 'member' and m.status = 'active' limit 1),
    'entitlements', coalesce((select jsonb_agg(e.entitlement) from public.my_entitlements() e), '[]'::jsonb)
  )
  from (select public.family_plan_owner(auth.uid()) as owner) o
$$;

revoke execute on function public.family_plan_owner(uuid) from public, anon, authenticated;
revoke execute on function public.has_entitlement(uuid, text) from public, anon, authenticated;
revoke execute on function public.my_entitlements(), public.my_plan() from public, anon;
grant execute on function public.my_entitlements(), public.my_plan() to authenticated;
