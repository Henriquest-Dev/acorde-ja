-- Row Level Security: cada utilizador só acede aos seus próprios dados.
-- Os administradores NÃO têm acesso a conversas, hábitos, recuperação nem
-- utilização individual; os encarregados de família só vêem agregados
-- (ver a vista family_usage_daily na migração seguinte).

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- Activa RLS em todas as tabelas públicas.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'devices', 'user_preferences', 'consent_records', 'app_catalog', 'app_limits', 'block_rules',
    'block_events', 'usage_daily', 'override_requests', 'focus_sessions', 'habits', 'habit_entries',
    'recovery_programs', 'recovery_checkins', 'ai_conversations', 'ai_messages', 'family_groups', 'family_members',
    'accountability_links', 'subscriptions', 'entitlements', 'notifications', 'support_tickets', 'admin_users', 'audit_logs'
  ] loop
    -- Sem FORCE: o dono (migrações, funções security definer, vistas agregadas)
    -- não fica sujeito às políticas; todos os papéis da API ficam.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tabelas do próprio utilizador: leitura e escrita completas.
do $$
declare t text;
begin
  foreach t in array array[
    'devices', 'app_limits', 'block_rules', 'usage_daily', 'focus_sessions', 'habits', 'habit_entries',
    'recovery_programs', 'recovery_checkins'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_delete_own', t);
  end loop;
end $$;

-- habit_entries: o hábito referido tem de pertencer ao mesmo utilizador.
create policy habit_entries_habit_owner on public.habit_entries as restrictive for insert to authenticated
  with check (exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid()));
create policy recovery_checkins_program_owner on public.recovery_checkins as restrictive for insert to authenticated
  with check (exists (select 1 from public.recovery_programs p where p.id = program_id and p.user_id = auth.uid()));

-- Perfil e preferências.
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy user_preferences_all_own on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Consentimentos: inserir e ler os próprios; nunca alterar nem apagar (prova).
create policy consent_select_own on public.consent_records for select to authenticated using (user_id = auth.uid());
create policy consent_insert_own on public.consent_records for insert to authenticated with check (user_id = auth.uid());

-- Catálogo público (só leitura).
create policy app_catalog_read on public.app_catalog for select to anon, authenticated using (true);

-- Eventos de bloqueio: append-only.
create policy block_events_select_own on public.block_events for select to authenticated using (user_id = auth.uid());
create policy block_events_insert_own on public.block_events for insert to authenticated with check (user_id = auth.uid());
create policy block_events_delete_own on public.block_events for delete to authenticated using (user_id = auth.uid());

-- Pedidos de tempo extra: o próprio cria/lê; o encarregado do grupo lê os pendentes (via RPC decide).
create policy override_select_own on public.override_requests for select to authenticated using (user_id = auth.uid());
create policy override_insert_own on public.override_requests for insert to authenticated
  with check (user_id = auth.uid() and (status = 'approved' or group_id is not null) and decided_by is null);

-- IA: o utilizador lê as suas conversas; a escrita é feita pela Edge Function (service role).
create policy ai_conversations_select_own on public.ai_conversations for select to authenticated using (user_id = auth.uid());
create policy ai_conversations_delete_own on public.ai_conversations for delete to authenticated using (user_id = auth.uid());
create policy ai_messages_select_own on public.ai_messages for select to authenticated using (user_id = auth.uid());

-- Responsabilidade: dono e parceiro vêem a ligação; só o dono altera; o parceiro aceita via RPC.
create policy accountability_select on public.accountability_links for select to authenticated
  using (owner_id = auth.uid() or partner_id = auth.uid());
create policy accountability_insert on public.accountability_links for insert to authenticated
  with check (owner_id = auth.uid() and partner_id is null and status = 'pending');
create policy accountability_update_owner on public.accountability_links for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy accountability_delete_owner on public.accountability_links for delete to authenticated using (owner_id = auth.uid());

-- Subscrições e entitlements: leitura própria; escrita só pelo servidor (webhooks).
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy entitlements_select_own on public.entitlements for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Suporte: o utilizador cria e lê os seus; a equipa (admin) lê e actualiza o estado.
create policy support_insert_own on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'open');
create policy support_select on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy support_update_admin on public.support_tickets for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Administração e auditoria.
create policy admin_users_select on public.admin_users for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- Família: membros do mesmo grupo vêem o grupo e os membros (nomes e papéis).
create or replace function public.my_group_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.family_members where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.is_group_guardian(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members
    where group_id = p_group and user_id = auth.uid() and role = 'guardian' and status = 'active'
  );
$$;

create policy family_groups_select on public.family_groups for select to authenticated using (id in (select public.my_group_ids()));
create policy family_members_select on public.family_members for select to authenticated using (group_id in (select public.my_group_ids()));
create policy family_members_update_guardian on public.family_members for update to authenticated
  using (public.is_group_guardian(group_id)) with check (public.is_group_guardian(group_id));
create policy override_select_guardian on public.override_requests for select to authenticated
  using (group_id is not null and public.is_group_guardian(group_id));

-- Privilégios: anon não tem acesso a dados de utilizadores.
revoke all on all tables in schema public from anon;
grant select on public.app_catalog to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
