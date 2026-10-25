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
