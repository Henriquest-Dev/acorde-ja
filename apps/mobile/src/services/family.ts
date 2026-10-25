import { requireSupabase } from './supabase';

/**
 * Família e parceiros de responsabilidade (dados no Supabase com RLS).
 * Os encarregados só vêem totais diários agregados dos menores do grupo —
 * nunca conversas, sites visitados, hábitos sensíveis ou mensagens.
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
}

export async function decideRequest(id: string, approve: boolean) {
  const { error } = await requireSupabase().rpc('decide_override_request', { p_request_id: id, p_approve: approve });
  if (error) throw error;
}

export async function leaveFamilyGroup() {
  const { error } = await requireSupabase().rpc('leave_family_group');
  if (error) throw error;
}
