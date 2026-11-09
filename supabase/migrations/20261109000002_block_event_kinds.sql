-- Novos tipos de evento enviados pelo app Android (bloqueio reforçado e filtro de sites do desafio).
alter table public.block_events drop constraint if exists block_events_kind_check;
alter table public.block_events add constraint block_events_kind_check check (kind in (
  'warning', 'blocked', 'scheduled_block', 'block_screen_shown', 'permission_revoked', 'clock_changed',
  'timezone_changed', 'device_rebooted', 'app_updated', 'shield_revoked', 'service_error',
  'shield_restarted', 'shield_revoked_locked', 'strong_block'
));
