-- offly: esquema completo para um projecto Supabase VAZIO.
-- Colar no SQL Editor (Dashboard → SQL Editor → New query) e carregar em Run, uma única vez.
-- Gerado a partir de supabase/migrations/*.sql (não editar à mão).
begin;

-- ===== 20261025000001_schema.sql =====
-- Acorde Já — esquema base
-- Princípios: dados mínimos, ids gerados no dispositivo para operações
-- idempotentes (client_event_id), eliminação em cascata a partir do utilizador,
-- e separação entre dados comportamentais sensíveis e dados administrativos.

create extension if not exists pgcrypto;

-- Utilitário: actualizar updated_at automaticamente.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identidade e dispositivos
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale text not null default 'pt-PT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  os_version text,
  app_version text,
  push_token text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index devices_user on public.devices (user_id);

create table public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Registo (append-only) das decisões de consentimento — prova RGPD.
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('cloudSync', 'syncSensitive', 'aiConsent', 'aiMemory', 'family', 'accountability')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index consent_records_user on public.consent_records (user_id, purpose, created_at desc);

-- ---------------------------------------------------------------------------
-- Limites e utilização
-- ---------------------------------------------------------------------------
create table public.app_catalog (
  id text primary key,
  name text not null,
  android_packages text[] not null default '{}',
  category text not null,
  default_limit_minutes int not null check (default_limit_minutes between 1 and 720)
);

create table public.app_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app_id text not null,
  app_name text not null,
  package_names text[] not null default '{}',
  limit_minutes int not null check (limit_minutes between 1 and 720),
  enabled boolean not null default true,
  client_event_id uuid,
  updated_at timestamptz not null default now(),
  unique (user_id, app_id)
);

create table public.block_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  enabled boolean not null default false,
  start_time time not null,
  end_time time not null,
  days smallint[] not null check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  app_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index block_rules_user on public.block_rules (user_id);

create table public.block_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app_id text,
  kind text not null check (kind in (
    'warning', 'blocked', 'scheduled_block', 'block_screen_shown', 'permission_revoked', 'clock_changed',
    'timezone_changed', 'device_rebooted', 'app_updated', 'shield_revoked', 'service_error'
  )),
  day date not null,
  client_event_id uuid,
  created_at timestamptz not null default now()
);
create index block_events_user_day on public.block_events (user_id, day);

create table public.usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id uuid not null,
  day date not null,
  app_id text not null,
  app_name text not null,
  used_ms bigint not null check (used_ms between 0 and 86400000),
  limit_ms bigint check (limit_ms >= 0),
  opens int check (opens >= 0),
  client_event_id uuid,
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, day, app_id)
);
create index usage_daily_user_day on public.usage_daily (user_id, day);

create table public.override_requests (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid,
  member_id uuid,
  app_id text not null,
  day date not null,
  extra_minutes int not null check (extra_minutes between 1 and 120),
  reason text not null check (reason in ('work', 'study', 'communication', 'emergency', 'other')),
  status text not null default 'approved' check (status in ('approved', 'pending', 'denied')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  client_event_id uuid,
  created_at timestamptz not null default now()
);
create index override_requests_user on public.override_requests (user_id, day);

create table public.focus_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_ms bigint not null check (planned_ms > 0),
  actual_ms bigint not null default 0 check (actual_ms >= 0),
  status text not null check (status in ('running', 'completed', 'cancelled')),
  mode text not null check (mode in ('timer', 'pomodoro', 'activity')),
  activity text,
  client_event_id uuid,
  check (ended_at is null or ended_at >= started_at)
);
create index focus_sessions_user on public.focus_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Dados comportamentais sensíveis (sincronizados só com consentimento específico)
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 60),
  icon text not null,
  frequency jsonb not null,
  target text check (char_length(target) <= 40),
  reminder_time time,
  archived_at timestamptz,
  client_event_id uuid,
  updated_at timestamptz not null default now()
);
create index habits_user on public.habits (user_id);

create table public.habit_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  completed_at timestamptz not null default now(),
  client_event_id uuid,
  unique (habit_id, day)
);
create index habit_entries_user_day on public.habit_entries (user_id, day);

create table public.recovery_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal text not null check (goal in ('reduce_social', 'avoid_porn', 'avoid_gambling', 'focus', 'sleep', 'healthy_habits')),
  plan jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.recovery_programs (id) on delete cascade,
  day date not null,
  mood smallint check (mood between 1 and 5),
  urges smallint check (urges between 0 and 10),
  note text check (char_length(note) <= 500),
  client_event_id uuid,
  created_at timestamptz not null default now(),
  unique (program_id, day)
);

create table public.ai_conversations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index ai_conversations_user on public.ai_conversations (user_id);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  flagged_crisis boolean not null default false,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index ai_messages_conv on public.ai_messages (conversation_id, created_at);
create index ai_messages_user_day on public.ai_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Família e responsabilidade
-- ---------------------------------------------------------------------------
create table public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  role text not null check (role in ('guardian', 'member')),
  birth_year smallint check (birth_year between 1900 and 2100),
  status text not null default 'active' check (status in ('invited', 'active')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index family_members_user on public.family_members (user_id);

alter table public.override_requests
  add constraint override_requests_group_id_fkey foreign key (group_id) references public.family_groups (id) on delete set null,
  add constraint override_requests_member_id_fkey foreign key (member_id) references public.family_members (id) on delete cascade;

create table public.accountability_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  partner_id uuid references auth.users (id) on delete cascade,
  invite_code text not null unique,
  shared_goals text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (partner_id is null or partner_id <> owner_id)
);

-- ---------------------------------------------------------------------------
-- Negócio, suporte e auditoria (dados administrativos)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store text not null check (store in ('google_play', 'app_store')),
  product_id text not null,
  original_transaction_id text not null,
  status text not null check (status in ('active', 'in_grace', 'on_hold', 'canceled', 'expired', 'refunded')),
  auto_renew boolean not null default true,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store, original_transaction_id)
);
create index subscriptions_user on public.subscriptions (user_id);

create table public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement text not null check (entitlement in ('plus', 'premium', 'family')),
  source_subscription_id uuid references public.subscriptions (id) on delete set null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user on public.notifications (user_id, sent_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  app_version text,
  platform text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'support', 'analyst')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created on public.audit_logs (created_at desc);

-- Triggers updated_at (só onde há actualizações).
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger user_preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();
create trigger app_limits_touch before update on public.app_limits for each row execute function public.touch_updated_at();
create trigger block_rules_touch before update on public.block_rules for each row execute function public.touch_updated_at();
create trigger usage_daily_touch before update on public.usage_daily for each row execute function public.touch_updated_at();
create trigger habits_touch before update on public.habits for each row execute function public.touch_updated_at();
create trigger recovery_programs_touch before update on public.recovery_programs for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
create trigger support_tickets_touch before update on public.support_tickets for each row execute function public.touch_updated_at();

-- Perfil criado automaticamente no registo.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.app_catalog (id, name, android_packages, category, default_limit_minutes) values
  ('instagram', 'Instagram', array['com.instagram.android'], 'social', 30),
  ('tiktok', 'TikTok', array['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'], 'social', 20),
  ('facebook', 'Facebook', array['com.facebook.katana', 'com.facebook.lite'], 'social', 20),
  ('youtube', 'YouTube', array['com.google.android.youtube'], 'video', 40);

-- ===== 20261025000002_rls.sql =====
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

-- ===== 20261025000003_functions.sql =====
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

-- ===== 20261107000001_external_billing.sql =====
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

-- ===== 20261109000001_indexes.sql =====
-- Índices para todas as chaves estrangeiras sem índice e para as consultas
-- mais frequentes (RLS filtra por user_id; o app ordena por data).
create index if not exists recovery_programs_user on public.recovery_programs (user_id);
create index if not exists recovery_checkins_user on public.recovery_checkins (user_id);
create index if not exists override_requests_decided_by on public.override_requests (decided_by);
create index if not exists override_requests_group on public.override_requests (group_id);
create index if not exists override_requests_member on public.override_requests (member_id);
create index if not exists family_groups_created_by on public.family_groups (created_by);
create index if not exists accountability_links_owner on public.accountability_links (owner_id);
create index if not exists accountability_links_partner on public.accountability_links (partner_id);
create index if not exists entitlements_source_subscription on public.entitlements (source_subscription_id);
create index if not exists support_tickets_user on public.support_tickets (user_id, created_at desc);
create index if not exists audit_logs_actor on public.audit_logs (actor_id);
create index if not exists billing_events_user on public.billing_events (user_id, received_at desc);
create index if not exists app_limits_user_updated on public.app_limits (user_id, updated_at desc);

-- ===== 20261109000002_block_event_kinds.sql =====
-- Novos tipos de evento enviados pelo app Android (bloqueio reforçado e filtro de sites do desafio).
alter table public.block_events drop constraint if exists block_events_kind_check;
alter table public.block_events add constraint block_events_kind_check check (kind in (
  'warning', 'blocked', 'scheduled_block', 'block_screen_shown', 'permission_revoked', 'clock_changed',
  'timezone_changed', 'device_rebooted', 'app_updated', 'shield_revoked', 'service_error',
  'shield_restarted', 'shield_revoked_locked', 'strong_block'
));

-- ===== 20261109000003_family_dashboard.sql =====
-- Conta família: o responsável (encarregado) vê, dos telemóveis que adicionou,
-- as apps usadas, o tempo de foco, os bloqueios e os limites, e pode definir limites.
-- O membro sabe disto quando entra no grupo (consentimento registado em join_family_group).
-- Os dados detalhados só saem por estas funções (security definer), nunca por leitura directa.

alter table public.app_limits add column if not exists managed_by uuid references auth.users (id) on delete set null;
create index if not exists app_limits_managed_by on public.app_limits (managed_by);

-- Um limite definido pelo responsável não pode ser alterado nem apagado pelo membro.
drop policy if exists app_limits_managed_no_insert on public.app_limits;
create policy app_limits_managed_no_insert on public.app_limits as restrictive for insert to authenticated
  with check (managed_by is null);
drop policy if exists app_limits_managed_no_update on public.app_limits;
create policy app_limits_managed_no_update on public.app_limits as restrictive for update to authenticated
  using (managed_by is null) with check (managed_by is null);
drop policy if exists app_limits_managed_no_delete on public.app_limits;
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

-- ===== 20261110000001_family_shared_plan.sql =====
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

-- ===== 20261110000002_profile_country_limits.sql =====
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

commit;
