import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_SETTINGS,
  RuleError,
  RuleState,
  canRequestException,
  evaluateApp,
  grantException,
  isScheduleActive,
  stateTransition,
  summarize,
  type AppRuleInput,
  type BlockSchedule,
  type PlatformCapability,
} from './engine';
import { MINUTE, dayKey } from '../time';

const granted: PlatformCapability = { canMeasure: true, canRestrict: true, permissionGranted: true };
const now = new Date(2026, 4, 12, 15, 0); // terça, 12 de Maio, 15:00

function input(usedMin: number | null, limit = 30, extra: AppRuleInput['exceptionsToday'] = []): AppRuleInput {
  return { appId: 'instagram', limitMinutes: limit, enabled: true, usedMs: usedMin === null ? null : usedMin * MINUTE, exceptionsToday: extra };
}
const ctx = { capability: granted, schedules: [] as BlockSchedule[], now };

describe('evaluateApp', () => {
  it('AVAILABLE abaixo de 80%', () => {
    expect(evaluateApp(input(18), ctx).state).toBe(RuleState.AVAILABLE);
  });

  it('WARNING a partir de 80% (16 de 20 min no TikTok)', () => {
    const r = evaluateApp({ ...input(16, 20), appId: 'tiktok' }, ctx);
    expect(r.state).toBe(RuleState.WARNING);
    expect(r.ratio).toBeCloseTo(0.8);
  });

  it('BLOCKED aos 100%', () => {
    const r = evaluateApp(input(30), ctx);
    expect(r.state).toBe(RuleState.BLOCKED);
    expect(r.remainingMs).toBe(0);
  });

  it('limite atingido durante uma sessão: transita WARNING → BLOCKED', () => {
    const before = evaluateApp(input(29), ctx).state;
    const after = evaluateApp(input(30), ctx).state;
    expect(before).toBe(RuleState.WARNING);
    expect(after).toBe(RuleState.BLOCKED);
    expect(stateTransition(before, after)).toBe('block');
  });

  it('limites independentes: duas aplicações utilizadas em sequência', () => {
    const insta = evaluateApp({ ...input(30, 30), appId: 'instagram' }, ctx);
    const tiktok = evaluateApp({ ...input(5, 20), appId: 'tiktok' }, ctx);
    expect(insta.state).toBe(RuleState.BLOCKED);
    expect(tiktok.state).toBe(RuleState.AVAILABLE);
  });

  it('PERMISSION_REQUIRED quando a permissão foi revogada (nunca inventa valores)', () => {
    const r = evaluateApp(input(10), { ...ctx, capability: { ...granted, permissionGranted: false } });
    expect(r.state).toBe(RuleState.PERMISSION_REQUIRED);
  });

  it('PERMISSION_REQUIRED quando a utilização é desconhecida', () => {
    expect(evaluateApp(input(null), ctx).state).toBe(RuleState.PERMISSION_REQUIRED);
  });

  it('UNAVAILABLE quando a plataforma não suporta medir nem restringir', () => {
    const r = evaluateApp(input(10), { ...ctx, capability: { canMeasure: false, canRestrict: false, permissionGranted: false } });
    expect(r.state).toBe(RuleState.UNAVAILABLE);
  });

  it('limite desactivado nunca bloqueia', () => {
    expect(evaluateApp({ ...input(90), enabled: false }, ctx).state).toBe(RuleState.AVAILABLE);
  });

  it('TEMPORARY_EXCEPTION enquanto houver tempo extra concedido', () => {
    const grant = { id: 'g1', appId: 'instagram', day: dayKey(now), extraMinutes: 5, reason: 'work' as const, grantedAt: 0 };
    expect(evaluateApp(input(32, 30, [grant]), ctx).state).toBe(RuleState.TEMPORARY_EXCEPTION);
    expect(evaluateApp(input(35, 30, [grant]), ctx).state).toBe(RuleState.BLOCKED);
  });
});

describe('horários de bloqueio', () => {
  const night: BlockSchedule = { id: 'night', enabled: true, start: '22:00', end: '07:00', days: [0, 1, 2, 3, 4, 5, 6], appIds: [] };

  it('atravessa a meia-noite', () => {
    expect(isScheduleActive(night, new Date(2026, 4, 12, 23, 30))).toBe(true);
    expect(isScheduleActive(night, new Date(2026, 4, 13, 6, 59))).toBe(true);
    expect(isScheduleActive(night, new Date(2026, 4, 13, 7, 0))).toBe(false);
    expect(isScheduleActive(night, new Date(2026, 4, 12, 21, 59))).toBe(false);
  });

  it('respeita o dia de início para horários nocturnos', () => {
    const fridayOnly = { ...night, days: [5] };
    expect(isScheduleActive(fridayOnly, new Date(2026, 4, 15, 23, 0))).toBe(true); // sexta 23:00
    expect(isScheduleActive(fridayOnly, new Date(2026, 4, 16, 2, 0))).toBe(true); // sábado 02:00
    expect(isScheduleActive(fridayOnly, new Date(2026, 4, 17, 2, 0))).toBe(false); // domingo 02:00
  });

  it('SCHEDULED_BLOCK tem prioridade sobre o limite diário', () => {
    const r = evaluateApp(input(1), { ...ctx, schedules: [night], now: new Date(2026, 4, 12, 23, 0) });
    expect(r.state).toBe(RuleState.SCHEDULED_BLOCK);
    expect(r.activeScheduleId).toBe('night');
  });

  it('horário desactivado é ignorado', () => {
    expect(isScheduleActive({ ...night, enabled: false }, new Date(2026, 4, 12, 23, 0))).toBe(false);
  });
});

describe('excepções conscientes', () => {
  const blocked = evaluateApp(input(30), ctx);

  it('modo estrito não permite excepções', () => {
    expect(canRequestException(blocked, { ...DEFAULT_RULE_SETTINGS, strictMode: true })).toEqual({ allowed: false, reason: 'strict_mode' });
  });

  it('exige pausa consciente de 30 segundos', () => {
    const t0 = 1_000_000;
    expect(() =>
      grantException({ id: 'x', result: blocked, settings: DEFAULT_RULE_SETTINGS, reason: 'work', day: '2026-05-12', pauseStartedAt: t0, now: t0 + 29_000 }),
    ).toThrow(RuleError);
    const g = grantException({ id: 'x', result: blocked, settings: DEFAULT_RULE_SETTINGS, reason: 'work', day: '2026-05-12', pauseStartedAt: t0, now: t0 + 30_000 });
    expect(g.extraMinutes).toBe(5);
  });

  it('respeita o máximo diário de excepções', () => {
    const grants = [1, 2].map((i) => ({ id: `g${i}`, appId: 'instagram', day: '2026-05-12', extraMinutes: 5, reason: 'work' as const, grantedAt: 0 }));
    const r = evaluateApp(input(40, 30, grants), ctx);
    expect(r.state).toBe(RuleState.BLOCKED);
    expect(canRequestException(r, DEFAULT_RULE_SETTINGS)).toEqual({ allowed: false, reason: 'max_reached' });
  });

  it('não concede durante um horário de bloqueio', () => {
    const night: BlockSchedule = { id: 'n', enabled: true, start: '22:00', end: '07:00', days: [0, 1, 2, 3, 4, 5, 6], appIds: [] };
    const r = evaluateApp(input(30), { ...ctx, schedules: [night], now: new Date(2026, 4, 12, 23, 0) });
    expect(canRequestException(r, DEFAULT_RULE_SETTINGS)).toEqual({ allowed: false, reason: 'scheduled_block' });
  });
});

describe('stateTransition / summarize', () => {
  it('só notifica ao entrar no estado', () => {
    expect(stateTransition(RuleState.AVAILABLE, RuleState.WARNING)).toBe('warn');
    expect(stateTransition(RuleState.WARNING, RuleState.WARNING)).toBeNull();
    expect(stateTransition(RuleState.TEMPORARY_EXCEPTION, RuleState.WARNING)).toBeNull();
  });

  it('resumo: utilização só de apps medidas, limite total de todas', () => {
    const s = summarize([
      evaluateApp(input(18, 30), ctx),
      evaluateApp({ ...input(12, 20), appId: 'tiktok' }, ctx),
      evaluateApp({ ...input(null, 40), appId: 'youtube' }, ctx),
    ]);
    expect(s.usedMs).toBe(30 * MINUTE);
    expect(s.limitMs).toBe(90 * MINUTE);
  });
});
