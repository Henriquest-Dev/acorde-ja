/**
 * Temporizador de foco baseado em timestamps persistidos: o tempo restante é
 * sempre calculado a partir de `startedAt` e das pausas, por isso continua
 * correcto quando o aplicativo vai para segundo plano ou é terminado.
 */

export type FocusStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';
export type FocusPhase = 'focus' | 'break';

export interface FocusTimerState {
  status: FocusStatus;
  phase: FocusPhase;
  durationMs: number;
  startedAt: number | null;
  /** Momento em que a pausa actual começou. */
  pausedAt: number | null;
  /** Total acumulado em pausas já terminadas. */
  pausedTotalMs: number;
}

export const IDLE_TIMER: FocusTimerState = {
  status: 'idle',
  phase: 'focus',
  durationMs: 25 * 60_000,
  startedAt: null,
  pausedAt: null,
  pausedTotalMs: 0,
};

export function startTimer(durationMs: number, now: number, phase: FocusPhase = 'focus'): FocusTimerState {
  if (durationMs <= 0) throw new Error('A duração tem de ser positiva');
  return { status: 'running', phase, durationMs, startedAt: now, pausedAt: null, pausedTotalMs: 0 };
}

export function elapsedMs(state: FocusTimerState, now: number): number {
  if (state.startedAt === null) return 0;
  const pausedNow = state.pausedAt !== null ? now - state.pausedAt : 0;
  // Protecção contra relógio que recuou: nunca negativo.
  return Math.min(state.durationMs, Math.max(0, now - state.startedAt - state.pausedTotalMs - pausedNow));
}

export function remainingMs(state: FocusTimerState, now: number): number {
  if (state.status === 'idle') return state.durationMs;
  return Math.max(0, state.durationMs - elapsedMs(state, now));
}

export function pauseTimer(state: FocusTimerState, now: number): FocusTimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', pausedAt: now };
}

export function resumeTimer(state: FocusTimerState, now: number): FocusTimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state;
  return { ...state, status: 'running', pausedAt: null, pausedTotalMs: state.pausedTotalMs + Math.max(0, now - state.pausedAt) };
}

export function cancelTimer(state: FocusTimerState): FocusTimerState {
  return { ...state, status: 'cancelled' };
}

/** Avança o estado: marca como concluído quando o tempo se esgotou. */
export function tick(state: FocusTimerState, now: number): FocusTimerState {
  if (state.status === 'running' && remainingMs(state, now) === 0) return { ...state, status: 'completed' };
  return state;
}

/** Momento previsto de conclusão (para agendar a notificação local). */
export function expectedEndAt(state: FocusTimerState): number | null {
  if (state.status !== 'running' || state.startedAt === null) return null;
  return state.startedAt + state.durationMs + state.pausedTotalMs;
}

export interface PomodoroConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export const DEFAULT_POMODORO: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

/** Duração da próxima fase do Pomodoro após `completedFocusCycles` ciclos. */
export function nextPomodoroPhase(
  current: FocusPhase,
  completedFocusCycles: number,
  cfg: PomodoroConfig = DEFAULT_POMODORO,
): { phase: FocusPhase; durationMs: number } {
  if (current === 'break') return { phase: 'focus', durationMs: cfg.focusMinutes * 60_000 };
  const long = completedFocusCycles > 0 && completedFocusCycles % cfg.cyclesBeforeLongBreak === 0;
  return { phase: 'break', durationMs: (long ? cfg.longBreakMinutes : cfg.shortBreakMinutes) * 60_000 };
}
