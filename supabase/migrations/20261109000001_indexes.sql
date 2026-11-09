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
