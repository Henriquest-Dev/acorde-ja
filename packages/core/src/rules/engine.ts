/**
 * Motor de regras determinístico do Acorde Já.
 *
 * É independente do assistente IA e de qualquer UI: recebe a configuração,
 * a utilização real medida pelo sistema e o instante actual, e devolve o
 * estado de cada aplicação. A mesma lógica está espelhada em Kotlin
 * (RuleEvaluator.kt) para funcionar com o aplicativo fechado; os testes
 * deste ficheiro são a especificação de referência.
 */

import { MINUTE, parseTimeOfDay } from '../time';

export const RuleState = {
  AVAILABLE: 'AVAILABLE',
  WARNING: 'WARNING',
  BLOCKED: 'BLOCKED',
  TEMPORARY_EXCEPTION: 'TEMPORARY_EXCEPTION',
  SCHEDULED_BLOCK: 'SCHEDULED_BLOCK',
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type RuleState = (typeof RuleState)[keyof typeof RuleState];

export const WARNING_THRESHOLD = 0.8;

export interface BlockSchedule {
  id: string;
  enabled: boolean;
  /** "22:00" */
  start: string;
  /** "07:00" — se for anterior a `start`, o horário atravessa a meia-noite. */
  end: string;
  /** Dias da semana em que o horário *começa* (0 = domingo … 6 = sábado). */
  days: number[];
  /** Ids de aplicações abrangidas; vazio = todas as aplicações controladas. */
  appIds: string[];
}

export interface ExceptionGrant {
  id: string;
  appId: string;
  /** Dia local (YYYY-MM-DD) a que a excepção pertence. */
  day: string;
  extraMinutes: number;
  reason: OverrideReason;
  grantedAt: number;
}

export type OverrideReason = 'work' | 'study' | 'communication' | 'emergency' | 'other';

export interface RuleSettings {
  /** Modo estrito: sem excepções. */
  strictMode: boolean;
  /** Minutos concedidos por cada excepção (por defeito 5). */
  exceptionMinutes: number;
  /** Máximo de excepções por aplicação e por dia. */
  maxExceptionsPerDay: number;
  /** Duração da pausa consciente antes de conceder tempo extra. */
  mindfulPauseSeconds: number;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  strictMode: false,
  exceptionMinutes: 5,
  maxExceptionsPerDay: 2,
  mindfulPauseSeconds: 30,
};

export interface PlatformCapability {
  /** O sistema operativo consegue medir a utilização desta app? */
  canMeasure: boolean;
  /** O sistema operativo consegue aplicar a restrição? */
  canRestrict: boolean;
  /** As permissões necessárias estão concedidas (confirmado pelo sistema)? */
  permissionGranted: boolean;
}

export interface AppRuleInput {
  appId: string;
  limitMinutes: number;
  enabled: boolean;
  /** Utilização real hoje (ms), medida pelo sistema. `null` = desconhecida. */
  usedMs: number | null;
  exceptionsToday: ExceptionGrant[];
}

export interface AppRuleResult {
  appId: string;
  state: RuleState;
  usedMs: number;
  limitMs: number;
  /** Limite + minutos de excepção concedidos hoje. */
  effectiveLimitMs: number;
  remainingMs: number;
  /** 0..1 (pode exceder 1 quando o tempo excede o limite). */
  ratio: number;
  activeScheduleId: string | null;
  exceptionsUsed: number;
}

export function isScheduleActive(schedule: BlockSchedule, now: Date): boolean {
  if (!schedule.enabled) return false;
  const start = parseTimeOfDay(schedule.start);
  const end = parseTimeOfDay(schedule.end);
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  if (start === end) return false;
  if (start < end) {
    return schedule.days.includes(today) && minuteOfDay >= start && minuteOfDay < end;
  }
  // Atravessa a meia-noite: activo desde `start` no dia de início até `end` no dia seguinte.
  if (minuteOfDay >= start) return schedule.days.includes(today);
  if (minuteOfDay < end) return schedule.days.includes(yesterday);
  return false;
}

export function activeScheduleFor(appId: string, schedules: BlockSchedule[], now: Date): BlockSchedule | null {
  return (
    schedules.find((s) => (s.appIds.length === 0 || s.appIds.includes(appId)) && isScheduleActive(s, now)) ?? null
  );
}

export function evaluateApp(
  input: AppRuleInput,
  ctx: { capability: PlatformCapability; schedules: BlockSchedule[]; now: Date },
): AppRuleResult {
  const limitMs = input.limitMinutes * MINUTE;
  const extraMs = input.exceptionsToday.reduce((sum, e) => sum + e.extraMinutes * MINUTE, 0);
  const effectiveLimitMs = limitMs + extraMs;
  const usedMs = input.usedMs ?? 0;
  const base = {
    appId: input.appId,
    usedMs,
    limitMs,
    effectiveLimitMs,
    remainingMs: Math.max(0, effectiveLimitMs - usedMs),
    ratio: limitMs > 0 ? usedMs / limitMs : 0,
    activeScheduleId: null as string | null,
    exceptionsUsed: input.exceptionsToday.length,
  };

  if (!ctx.capability.canMeasure && !ctx.capability.canRestrict) {
    return { ...base, state: RuleState.UNAVAILABLE };
  }
  if (!ctx.capability.permissionGranted || input.usedMs === null) {
    return { ...base, state: RuleState.PERMISSION_REQUIRED };
  }

  const schedule = input.enabled ? activeScheduleFor(input.appId, ctx.schedules, ctx.now) : null;
  if (schedule) {
    return { ...base, activeScheduleId: schedule.id, remainingMs: 0, state: RuleState.SCHEDULED_BLOCK };
  }
  if (!input.enabled) return { ...base, state: RuleState.AVAILABLE };

  if (usedMs >= limitMs) {
    if (usedMs < effectiveLimitMs) return { ...base, state: RuleState.TEMPORARY_EXCEPTION };
    return { ...base, state: RuleState.BLOCKED };
  }
  if (usedMs >= limitMs * WARNING_THRESHOLD) return { ...base, state: RuleState.WARNING };
  return { ...base, state: RuleState.AVAILABLE };
}

export type ExceptionDenial = 'strict_mode' | 'max_reached' | 'not_blocked' | 'scheduled_block';

export function canRequestException(
  result: AppRuleResult,
  settings: RuleSettings,
): { allowed: true } | { allowed: false; reason: ExceptionDenial } {
  if (settings.strictMode) return { allowed: false, reason: 'strict_mode' };
  if (result.state === RuleState.SCHEDULED_BLOCK) return { allowed: false, reason: 'scheduled_block' };
  if (result.state !== RuleState.BLOCKED) return { allowed: false, reason: 'not_blocked' };
  if (result.exceptionsUsed >= settings.maxExceptionsPerDay) return { allowed: false, reason: 'max_reached' };
  return { allowed: true };
}

/**
 * Concede uma excepção depois de cumprida a pausa consciente.
 * `pauseStartedAt` tem de ter pelo menos `mindfulPauseSeconds` de antiguidade.
 */
export function grantException(params: {
  id: string;
  result: AppRuleResult;
  settings: RuleSettings;
  reason: OverrideReason;
  day: string;
  pauseStartedAt: number;
  now: number;
}): ExceptionGrant {
  const check = canRequestException(params.result, params.settings);
  if (!check.allowed) throw new RuleError(check.reason);
  if (params.now - params.pauseStartedAt < params.settings.mindfulPauseSeconds * 1000) {
    throw new RuleError('pause_incomplete');
  }
  return {
    id: params.id,
    appId: params.result.appId,
    day: params.day,
    extraMinutes: params.settings.exceptionMinutes,
    reason: params.reason,
    grantedAt: params.now,
  };
}

export class RuleError extends Error {
  constructor(public readonly code: ExceptionDenial | 'pause_incomplete') {
    super(code);
    this.name = 'RuleError';
  }
}

/**
 * Transições que devem gerar notificação/registo: só ao *entrar* num estado,
 * para que a mesma condição não notifique repetidamente.
 */
export function stateTransition(
  prev: RuleState | undefined,
  next: RuleState,
): 'warn' | 'block' | 'schedule' | 'exception' | null {
  if (prev === next) return null;
  switch (next) {
    case RuleState.WARNING:
      return prev === RuleState.AVAILABLE || prev === undefined ? 'warn' : null;
    case RuleState.BLOCKED:
      return 'block';
    case RuleState.SCHEDULED_BLOCK:
      return 'schedule';
    case RuleState.TEMPORARY_EXCEPTION:
      return 'exception';
    default:
      return null;
  }
}

export function summarize(results: AppRuleResult[]) {
  const measurable = results.filter(
    (r) => r.state !== RuleState.PERMISSION_REQUIRED && r.state !== RuleState.UNAVAILABLE,
  );
  const usedMs = measurable.reduce((s, r) => s + r.usedMs, 0);
  // O limite total é configuração (não medição): conta sempre.
  const limitMs = results.reduce((s, r) => s + r.limitMs, 0);
  return {
    usedMs,
    limitMs,
    remainingMs: Math.max(0, limitMs - usedMs),
    ratio: limitMs > 0 ? usedMs / limitMs : 0,
    blockedCount: results.filter((r) => r.state === RuleState.BLOCKED || r.state === RuleState.SCHEDULED_BLOCK).length,
  };
}
