import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { applyManagedLimits } from '@/repositories/limits';
import { usePrefs } from '@/stores/prefs';
import { getSupabase, requireSupabase } from './supabase';
import { getDeviceId, syncRulesToNative } from './usage';

/**
 * Conta família (dados no Supabase com RLS).
 * O responsável vê, dos telemóveis que adicionou: apps usadas, tempo de foco,
 * bloqueios e limites, e pode definir limites. Nunca vê conversas, mensagens,
 * sites visitados nem hábitos sensíveis.
 */

export interface FamilyMember {
  id: string;
  userId: string | null;
  displayName: string;
  role: 'guardian' | 'member';
  birthYear: number | null;
  status: 'invited' | 'active';
}

export interface FamilyOverview {
  group: { id: string; name: string; inviteCode: string } | null;
  members: FamilyMember[];
  /** Totais diários (minutos) da semana por membro, apenas para encarregados. */
  weekly: { day: string; minutes: number }[];
  pendingRequests: { id: string; memberName: string; appId: string; extraMinutes: number; reason: string; createdAt: string }[];
  isGuardian: boolean;
}

export async function loadFamily(weekDays: string[]): Promise<FamilyOverview> {
  const sb = requireSupabase();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error('Sessão não iniciada');
  const { data: membership, error } = await sb
    .from('family_members')
    .select('role, family_groups(id, name, invite_code)')
    .eq('user_id', user.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  const groupRow = membership?.family_groups as unknown as { id: string; name: string; invite_code: string } | null;
  if (!groupRow) return { group: null, members: [], weekly: [], pendingRequests: [], isGuardian: false };
  const isGuardian = membership?.role === 'guardian';

  const { data: members } = await sb
    .from('family_members')
    .select('id, user_id, display_name, role, birth_year, status')
    .eq('group_id', groupRow.id)
    .order('created_at');

  let weekly: FamilyOverview['weekly'] = weekDays.map((day) => ({ day, minutes: 0 }));
  let pendingRequests: FamilyOverview['pendingRequests'] = [];
  if (isGuardian) {
    // View agregada protegida por RLS: apenas soma diária por membro.
    const { data: usage } = await sb
      .from('family_usage_daily')
      .select('day, total_ms')
      .eq('group_id', groupRow.id)
      .in('day', weekDays);
    weekly = weekDays.map((day) => ({
      day,
      minutes: Math.round((usage ?? []).filter((u) => u.day === day).reduce((s, u) => s + Number(u.total_ms), 0) / 60_000),
    }));
    const { data: requests } = await sb
      .from('override_requests')
      .select('id, app_id, extra_minutes, reason, created_at, family_members!override_requests_member_id_fkey(display_name)')
      .eq('group_id', groupRow.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    pendingRequests = (requests ?? []).map((r) => ({
      id: r.id as string,
      appId: r.app_id as string,
      extraMinutes: r.extra_minutes as number,
      reason: r.reason as string,
      createdAt: r.created_at as string,
      memberName: (r.family_members as unknown as { display_name: string } | null)?.display_name ?? 'Membro',
    }));
  }

  return {
    group: { id: groupRow.id, name: groupRow.name, inviteCode: groupRow.invite_code },
    members: (members ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      displayName: m.display_name,
      role: m.role,
      birthYear: m.birth_year,
      status: m.status,
    })),
    weekly,
    pendingRequests,
    isGuardian,
  };
}

export async function createFamilyGroup(name: string, displayName: string) {
  const { data, error } = await requireSupabase().rpc('create_family_group', { p_name: name, p_display_name: displayName });
  if (error) throw error;
  return data as string;
}

export async function joinFamilyGroup(code: string, displayName: string, birthYear: number | null) {
  const { error } = await requireSupabase().rpc('join_family_group', {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName,
    p_birth_year: birthYear,
  });
  if (error) throw error;
  // O responsável só vê o que é sincronizado: entrar no grupo liga a sincronização (consentimento dado no ecrã de entrada).
  await usePrefs.getState().update({ cloudSync: true });
  await refreshFamilyLink();
}

// ------------------------------------------------------------------ painel do responsável
export interface DashboardMember {
  memberId: string;
  name: string;
  birthYear: number | null;
  linked: boolean;
  devices: { platform: string; os: string | null; appVersion: string | null; lastSeenAt: string }[];
  usage: { day: string; appId: string; appName: string; usedMs: number; limitMs: number | null }[];
  focus: { day: string; minutes: number }[];
  blocks: { appId: string; count: number; lastDay: string }[];
  limits: { appId: string; appName: string; limitMinutes: number; enabled: boolean; managed: boolean }[];
}

interface RawMember {
  member_id: string;
  name: string;
  birth_year: number | null;
  linked: boolean;
  devices: { platform: string; os: string | null; app_version: string | null; last_seen_at: string }[];
  usage: { day: string; app_id: string; app_name: string; used_ms: number; limit_ms: number | null }[];
  focus: { day: string; minutes: number }[];
  blocks: { app_id: string; count: number; last_day: string }[];
  limits: { app_id: string; app_name: string; limit_minutes: number; enabled: boolean; managed: boolean }[];
}

export function mapDashboard(raw: { members?: RawMember[] } | null): DashboardMember[] {
  return (raw?.members ?? []).map((m) => ({
    memberId: m.member_id,
    name: m.name,
    birthYear: m.birth_year,
    linked: m.linked,
    devices: m.devices.map((d) => ({ platform: d.platform, os: d.os, appVersion: d.app_version, lastSeenAt: d.last_seen_at })),
    usage: m.usage.map((u) => ({ day: u.day, appId: u.app_id, appName: u.app_name, usedMs: Number(u.used_ms), limitMs: u.limit_ms == null ? null : Number(u.limit_ms) })),
    focus: m.focus,
    blocks: m.blocks.map((b) => ({ appId: b.app_id, count: b.count, lastDay: b.last_day })),
    limits: m.limits.map((l) => ({ appId: l.app_id, appName: l.app_name, limitMinutes: l.limit_minutes, enabled: l.enabled, managed: l.managed })),
  }));
}

export async function loadDashboard(days = 7): Promise<DashboardMember[]> {
  const { data, error } = await requireSupabase().rpc('family_dashboard', { p_days: days });
  if (error) throw error;
  return mapDashboard(data as { members?: RawMember[] });
}

export async function setMemberLimit(memberId: string, app: { appId: string; name: string; packageNames: string[] }, minutes: number, enabled = true) {
  const { error } = await requireSupabase().rpc('family_set_member_limit', {
    p_member: memberId,
    p_app_id: app.appId,
    p_app_name: app.name,
    p_packages: app.packageNames,
    p_minutes: minutes,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function clearMemberLimit(memberId: string, appId: string) {
  const { error } = await requireSupabase().rpc('family_clear_member_limit', { p_member: memberId, p_app_id: appId });
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await requireSupabase().rpc('family_remove_member', { p_member: memberId });
  if (error) throw error;
}

// ------------------------------------------------------------------ telemóvel do membro
/**
 * Regista este telemóvel na conta (para aparecer no painel do responsável) e aplica
 * os limites que o responsável definiu. Os limites ficam guardados localmente: o
 * bloqueio continua a funcionar sem internet.
 */
export async function refreshFamilyLink(): Promise<{ limitsChanged: boolean } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: session } = await sb.auth.getSession();
  if (!session.session) return null;
  const deviceId = await getDeviceId();
  await sb.from('devices').upsert({
    id: deviceId,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    os_version: String(Platform.Version ?? ''),
    app_version: Constants.expoConfig?.version ?? null,
    last_seen_at: new Date().toISOString(),
  });
  const { data, error } = await sb.rpc('my_managed_limits');
  if (error || !Array.isArray(data)) return { limitsChanged: false };
  const changed = await applyManagedLimits(
    (data as { app_id: string; app_name: string; package_names: string[]; limit_minutes: number; enabled: boolean }[]).map((l) => ({
      appId: l.app_id,
      name: l.app_name,
      packageNames: l.package_names,
      limitMinutes: l.limit_minutes,
      enabled: l.enabled,
    })),
  );
  if (changed) await syncRulesToNative();
  return { limitsChanged: changed };
}

export async function decideRequest(id: string, approve: boolean) {
  const { error } = await requireSupabase().rpc('decide_override_request', { p_request_id: id, p_approve: approve });
  if (error) throw error;
}

export async function leaveFamilyGroup() {
  const { error } = await requireSupabase().rpc('leave_family_group');
  if (error) throw error;
}
