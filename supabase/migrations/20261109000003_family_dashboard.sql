-- Conta família: o responsável (encarregado) vê, dos telemóveis que adicionou,
-- as apps usadas, o tempo de foco, os bloqueios e os limites, e pode definir limites.
-- O membro sabe disto quando entra no grupo (consentimento registado em join_family_group).
-- Os dados detalhados só saem por estas funções (security definer), nunca por leitura directa.

alter table public.app_limits add column if not exists managed_by uuid references auth.users (id) on delete set null;
create index if not exists app_limits_managed_by on public.app_limits (managed_by);

-- Um limite definido pelo responsável não pode ser alterado nem apagado pelo membro.
create policy app_limits_managed_no_insert on public.app_limits as restrictive for insert to authenticated
  with check (managed_by is null);
create policy app_limits_managed_no_update on public.app_limits as restrictive for update to authenticated
  using (managed_by is null) with check (managed_by is null);
create policy app_limits_managed_no_delete on public.app_limits as restrictive for delete to authenticated
  using (managed_by is null);

/** Painel do responsável: membros activos, telemóveis, apps usadas, foco, bloqueios e limites dos últimos p_days dias. */
create or replace function public.family_dashboard(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  g uuid;
  d int := least(greatest(coalesce(p_days, 7), 1), 31);
  since date := current_date - (least(greatest(coalesce(p_days, 7), 1), 31) - 1);
  res jsonb;
begin
  select group_id into g from family_members where user_id = auth.uid() and role = 'guardian' and status = 'active';
  if g is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(m order by m ->> 'name'), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'member_id', fm.id,
      'name', fm.display_name,
      'birth_year', fm.birth_year,
      'linked', fm.user_id is not null,
      'devices', (select coalesce(jsonb_agg(jsonb_build_object('platform', dv.platform, 'os', dv.os_version, 'app_version', dv.app_version, 'last_seen_at', dv.last_seen_at) order by dv.last_seen_at desc), '[]'::jsonb)
                  from devices dv where dv.user_id = fm.user_id),
      'usage', (select coalesce(jsonb_agg(jsonb_build_object('day', u.day, 'app_id', u.app_id, 'app_name', u.app_name, 'used_ms', u.used_ms, 'limit_ms', u.limit_ms) order by u.day, u.used_ms desc), '[]'::jsonb)
                from usage_daily u where u.user_id = fm.user_id and u.day >= since),
      'focus', (select coalesce(jsonb_agg(jsonb_build_object('day', f.day, 'minutes', f.minutes) order by f.day), '[]'::jsonb)
                from (select started_at::date as day, (sum(actual_ms) / 60000)::int as minutes from focus_sessions
                      where user_id = fm.user_id and status = 'completed' and started_at::date >= since group by 1) f),
      'blocks', (select coalesce(jsonb_agg(jsonb_build_object('app_id', b.app_id, 'count', b.n, 'last_day', b.last_day) order by b.n desc), '[]'::jsonb)
                 from (select app_id, count(*)::int as n, max(day) as last_day from block_events
                       where user_id = fm.user_id and app_id is not null and day >= since
                         and kind in ('blocked', 'scheduled_block', 'strong_block', 'block_screen_shown')
                       group by app_id) b),
      'limits', (select coalesce(jsonb_agg(jsonb_build_object('app_id', l.app_id, 'app_name', l.app_name, 'limit_minutes', l.limit_minutes, 'enabled', l.enabled, 'managed', l.managed_by is not null) order by l.app_name), '[]'::jsonb)
                 from app_limits l where l.user_id = fm.user_id)
    ) as m
    from family_members fm
    where fm.group_id = g and fm.role = 'member' and fm.status = 'active'
  ) s;
  return jsonb_build_object('group_id', g, 'days', d, 'members', res);
end $$;

/** O responsável define (ou actualiza) o limite de uma app num telemóvel do grupo. */
create or replace function public.family_set_member_limit(
  p_member uuid, p_app_id text, p_app_name text, p_packages text[], p_minutes int, p_enabled boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid; g uuid;
begin
  select user_id, group_id into u, g from family_members where id = p_member and role = 'member' and status = 'active';
  if u is null or not is_group_guardian(g) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 720 then raise exception 'invalid_minutes' using errcode = '22023'; end if;
  insert into app_limits (user_id, app_id, app_name, package_names, limit_minutes, enabled, managed_by)
  values (u, left(p_app_id, 80), left(p_app_name, 80), coalesce(p_packages, '{}'), p_minutes, coalesce(p_enabled, true), auth.uid())
  on conflict (user_id, app_id) do update
    set app_name = excluded.app_name, package_names = excluded.package_names, limit_minutes = excluded.limit_minutes,
        enabled = excluded.enabled, managed_by = excluded.managed_by;
  insert into audit_logs (actor_id, action, target_table, target_id, meta)
  values (auth.uid(), 'family.set_limit', 'app_limits', p_member::text, jsonb_build_object('app_id', p_app_id, 'minutes', p_minutes));
end $$;

/** O responsável retira um limite que definiu. */
create or replace function public.family_clear_member_limit(p_member uuid, p_app_id text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid; g uuid;
begin
  select user_id, group_id into u, g from family_members where id = p_member and role = 'member' and status = 'active';
  if u is null or not is_group_guardian(g) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from app_limits where user_id = u and app_id = p_app_id and managed_by is not null;
end $$;

/** O responsável retira um telemóvel (membro) do grupo; os limites que definiu deixam de ser geridos. */
create or replace function public.family_remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from family_members where id = p_member;
  if m is null or m.role <> 'member' or not is_group_guardian(m.group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update app_limits set managed_by = null where user_id = m.user_id and managed_by is not null;
  delete from family_members where id = p_member;
  insert into audit_logs (actor_id, action, target_table, target_id) values (auth.uid(), 'family.remove_member', 'family_members', p_member::text);
end $$;

/** O telemóvel do membro lê os limites definidos pelo responsável (aplicados mesmo offline depois). */
create or replace function public.my_managed_limits() returns table (app_id text, app_name text, package_names text[], limit_minutes int, enabled boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select app_id, app_name, package_names, limit_minutes, enabled, updated_at from app_limits
  where user_id = auth.uid() and managed_by is not null
$$;

revoke execute on function public.family_dashboard(int), public.family_set_member_limit(uuid, text, text, text[], int, boolean),
  public.family_clear_member_limit(uuid, text), public.family_remove_member(uuid), public.my_managed_limits() from public, anon;
grant execute on function public.family_dashboard(int), public.family_set_member_limit(uuid, text, text, text[], int, boolean),
  public.family_clear_member_limit(uuid, text), public.family_remove_member(uuid), public.my_managed_limits() to authenticated;
