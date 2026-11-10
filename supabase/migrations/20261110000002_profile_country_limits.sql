-- Perfil: nome e país (para as linhas de ajuda e a variante da língua do assistente).
-- Limites diários até 24 horas (antes 12).
alter table public.profiles add column if not exists country text check (country ~ '^[A-Z]{2}$');
alter table public.profiles add column if not exists help_lines jsonb;

alter table public.app_limits drop constraint if exists app_limits_limit_minutes_check;
alter table public.app_limits add constraint app_limits_limit_minutes_check check (limit_minutes between 1 and 1440);

create or replace function public.family_set_member_limit(
  p_member uuid, p_app_id text, p_app_name text, p_packages text[], p_minutes int, p_enabled boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid; g uuid;
begin
  select user_id, group_id into u, g from family_members where id = p_member and role = 'member' and status = 'active';
  if u is null or not is_group_guardian(g) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then raise exception 'invalid_minutes' using errcode = '22023'; end if;
  insert into app_limits (user_id, app_id, app_name, package_names, limit_minutes, enabled, managed_by)
  values (u, left(p_app_id, 80), left(p_app_name, 80), coalesce(p_packages, '{}'), p_minutes, coalesce(p_enabled, true), auth.uid())
  on conflict (user_id, app_id) do update
    set app_name = excluded.app_name, package_names = excluded.package_names, limit_minutes = excluded.limit_minutes,
        enabled = excluded.enabled, managed_by = excluded.managed_by;
  insert into audit_logs (actor_id, action, target_table, target_id, meta)
  values (auth.uid(), 'family.set_limit', 'app_limits', p_member::text, jsonb_build_object('app_id', p_app_id, 'minutes', p_minutes));
end $$;
