import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHIELD,
  HOUR,
  MINUTE,
  buildReport,
  dayKey,
  detectClockAnomaly,
  elapsedMs,
  evaluateDomain,
  expectedEndAt,
  formatClock,
  formatDuration,
  formatHoursMinutes,
  formatShortDate,
  greeting,
  habitFormSchema,
  isDueOn,
  nextLocalMidnight,
  nextPomodoroPhase,
  normalizeDomain,
  pauseTimer,
  percentChange,
  periodRange,
  remainingMs,
  reportToCsv,
  resumeTimer,
  startTimer,
  tick,
  toggleEntry,
  todaySummary,
  weeklyProgress,
  withOthers,
  type Habit,
  type UsageDailyRow,
} from './index';

describe('tempo', () => {
  it('formata como no design', () => {
    expect(formatDuration(95 * MINUTE)).toBe('1h 35min');
    expect(formatHoursMinutes(3 * HOUR)).toBe('3h 00min');
    expect(formatDuration(18 * MINUTE)).toBe('18 min');
    expect(formatClock(25 * MINUTE)).toBe('25:00');
    expect(formatShortDate(new Date(2026, 4, 11))).toBe('Seg, 11 de Maio');
  });

  it('saudação dinâmica', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Bom dia!');
    expect(greeting(new Date(2026, 0, 1, 15))).toBe('Boa tarde!');
    expect(greeting(new Date(2026, 0, 1, 23))).toBe('Boa noite!');
  });

  it('reinício diário à meia-noite local', () => {
    const d = new Date(2026, 4, 12, 23, 59);
    expect(dayKey(d)).toBe('2026-05-12');
    expect(dayKey(nextLocalMidnight(d))).toBe('2026-05-13');
  });

  it('detecta alteração manual do relógio', () => {
    const prev = { wallMs: 1_000_000, monotonicMs: 50_000, tzOffsetMin: 0 };
    expect(detectClockAnomaly(prev, { wallMs: 1_060_000, monotonicMs: 110_000, tzOffsetMin: 0 })).toEqual({ kind: 'none' });
    const moved = detectClockAnomaly(prev, { wallMs: 1_000_000 + 3 * HOUR, monotonicMs: 110_000, tzOffsetMin: 0 });
    expect(moved.kind).toBe('clock_moved');
  });

  it('detecta alteração de fuso horário', () => {
    const prev = { wallMs: 0, monotonicMs: 0, tzOffsetMin: 0 };
    expect(detectClockAnomaly(prev, { wallMs: 1000, monotonicMs: 1000, tzOffsetMin: -60 }).kind).toBe('timezone_changed');
  });

  it('dispositivo reiniciado (monotónico recua) não é tratado como adulteração', () => {
    const prev = { wallMs: 0, monotonicMs: 999_999, tzOffsetMin: 0 };
    expect(detectClockAnomaly(prev, { wallMs: 10 * HOUR, monotonicMs: 1000, tzOffsetMin: 0 }).kind).toBe('none');
  });
});

describe('temporizador de foco', () => {
  it('mantém a contagem correcta em segundo plano (baseado em timestamps)', () => {
    const t = startTimer(25 * MINUTE, 0);
    // Aplicação em segundo plano durante 10 minutos: nenhum tick intermédio.
    expect(remainingMs(t, 10 * MINUTE)).toBe(15 * MINUTE);
    expect(tick(t, 25 * MINUTE).status).toBe('completed');
  });

  it('pausa e retoma', () => {
    let t = startTimer(25 * MINUTE, 0);
    t = pauseTimer(t, 5 * MINUTE);
    expect(remainingMs(t, 30 * MINUTE)).toBe(20 * MINUTE);
    t = resumeTimer(t, 30 * MINUTE);
    expect(remainingMs(t, 31 * MINUTE)).toBe(19 * MINUTE);
    expect(expectedEndAt(t)).toBe(50 * MINUTE);
  });

  it('relógio que recua não produz tempo negativo', () => {
    const t = startTimer(MINUTE, 10_000);
    expect(elapsedMs(t, 0)).toBe(0);
  });

  it('Pomodoro alterna foco/pausa e faz pausa longa a cada 4 ciclos', () => {
    expect(nextPomodoroPhase('focus', 1).durationMs).toBe(5 * MINUTE);
    expect(nextPomodoroPhase('focus', 4).durationMs).toBe(15 * MINUTE);
    expect(nextPomodoroPhase('break', 4).phase).toBe('focus');
  });
});

describe('hábitos', () => {
  const habit: Habit = { id: 'h', title: 'Ler', icon: 'book', frequency: { kind: 'weekdays', days: [1, 3, 5] }, target: null, reminderTime: null, archivedAt: null, createdAt: 0 };

  it('frequência por dias da semana', () => {
    expect(isDueOn(habit, new Date(2026, 4, 11))).toBe(true); // segunda
    expect(isDueOn(habit, new Date(2026, 4, 12))).toBe(false); // terça
  });

  it('alternar conclusão é idempotente por dia', () => {
    let n = 0;
    const r1 = toggleEntry([], 'h', '2026-05-11', () => `e${++n}`, 0);
    expect(r1.added?.id).toBe('e1');
    const r2 = toggleEntry(r1.entries, 'h', '2026-05-11', () => `e${++n}`, 0);
    expect(r2.entries).toHaveLength(0);
    expect(r2.removed?.id).toBe('e1');
  });

  it('progresso semanal e resumo de hoje', () => {
    const entries = [{ id: '1', habitId: 'h', day: '2026-05-11', completedAt: 0 }];
    expect(weeklyProgress(habit, entries, new Date(2026, 4, 13))).toMatchObject({ done: 1, expected: 3 });
    expect(todaySummary([habit], entries, new Date(2026, 4, 11))).toEqual({ due: 1, done: 1 });
  });

  it('valida o formulário', () => {
    expect(habitFormSchema.safeParse({ title: 'L', icon: 'x', target: null, frequency: { kind: 'daily' }, reminderTime: null }).success).toBe(false);
    expect(habitFormSchema.safeParse({ title: 'Ler', icon: 'x', target: null, frequency: { kind: 'daily' }, reminderTime: '21:30' }).success).toBe(true);
  });
});

describe('relatórios', () => {
  const rows: UsageDailyRow[] = [
    { day: '2026-05-11', appId: 'instagram', appName: 'Instagram', usedMs: 40 * MINUTE, limitMs: 30 * MINUTE, opens: 12 },
    { day: '2026-05-12', appId: 'instagram', appName: 'Instagram', usedMs: 18 * MINUTE, limitMs: 30 * MINUTE, opens: null },
    { day: '2026-05-12', appId: 'tiktok', appName: 'TikTok', usedMs: 12 * MINUTE, limitMs: 20 * MINUTE, opens: 4 },
    { day: '2026-05-12', appId: 'com.x', appName: 'X', usedMs: 5 * MINUTE, limitMs: null, opens: null },
  ];

  it('agrega por semana com dias de segunda a domingo', () => {
    const range = periodRange('week', new Date(2026, 4, 12));
    expect(range.days[0]).toBe('2026-05-11');
    expect(range.days).toHaveLength(7);
    const r = buildReport(rows, range);
    expect(r.totalMs).toBe(75 * MINUTE);
    expect(r.exceededMs).toBe(10 * MINUTE);
    expect(r.byApp[0]!.appId).toBe('instagram');
    expect(r.byDay[1]!.totalMs).toBe(35 * MINUTE);
  });

  it('agrupa restantes em «Outros»', () => {
    const r = buildReport(rows, periodRange('day', new Date(2026, 4, 12)));
    const list = withOthers(r.byApp, ['instagram', 'tiktok']);
    expect(list.at(-1)).toMatchObject({ appName: 'Outros', usedMs: 5 * MINUTE });
  });

  it('variação percentual sem linha de base é null (não inventa)', () => {
    expect(percentChange(52, 100)).toBe(-48);
    expect(percentChange(10, 0)).toBeNull();
  });

  it('exporta CSV', () => {
    const csv = reportToCsv(rows.slice(0, 2));
    expect(csv).toBe('dia,app,minutos_utilizados,limite_minutos,aberturas\n2026-05-11,Instagram,40,30,12\n2026-05-12,Instagram,18,30,\n');
  });
});

describe('Digital Shield', () => {
  it('normaliza domínios', () => {
    expect(normalizeDomain('https://www.Bet365.com/pt/desporto')).toBe('bet365.com');
    expect(normalizeDomain('não é domínio')).toBeNull();
  });

  it('bloqueia subdomínios das categorias activas', () => {
    const cfg = { ...DEFAULT_SHIELD, categories: { ...DEFAULT_SHIELD.categories, gambling: true } };
    expect(evaluateDomain('sports.bet365.com', cfg, new Date())).toEqual({ blocked: true, reason: 'gambling' });
    expect(evaluateDomain('publico.pt', cfg, new Date())).toEqual({ blocked: false });
    expect(evaluateDomain('notbet365.com', cfg, new Date())).toEqual({ blocked: false });
  });

  it('lista de permitidos não se sobrepõe ao modo estrito', () => {
    const cfg = { ...DEFAULT_SHIELD, categories: { ...DEFAULT_SHIELD.categories, adult: true }, allowDomains: ['xvideos.com'] };
    expect(evaluateDomain('xvideos.com', cfg, new Date()).blocked).toBe(false);
    expect(evaluateDomain('xvideos.com', { ...cfg, strictMode: true }, new Date()).blocked).toBe(true);
  });
});
