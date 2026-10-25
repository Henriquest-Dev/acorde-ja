import {
  IDLE_TIMER,
  cancelTimer,
  elapsedMs,
  expectedEndAt,
  nextPomodoroPhase,
  pauseTimer,
  resumeTimer,
  startTimer,
  tick,
  type FocusTimerState,
} from '@acorde/core';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { kvGet, kvSet } from '@/repositories/kv';
import { deleteSchedule, upsertSchedule } from '@/repositories/limits';
import { saveFocusSession } from '@/repositories/focus';
import { cancelNotification, scheduleFocusEnd } from '@/services/notifications';
import { enqueueSync } from '@/services/sync';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from './prefs';

export const FOCUS_SCHEDULE_ID = 'focus-session';

interface Persisted {
  timer: FocusTimerState;
  sessionId: string | null;
  notificationId: string | null;
  activity: string | null;
  pomodoro: boolean;
  cycles: number;
}

interface FocusStore extends Persisted {
  loaded: boolean;
  load(): Promise<void>;
  start(minutes: number, opts?: { activity?: string | null; pomodoro?: boolean }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  /** Chamado a cada segundo e ao voltar ao primeiro plano. */
  check(): Promise<void>;
}

const KEY = 'focusTimer';
const initial: Persisted = { timer: IDLE_TIMER, sessionId: null, notificationId: null, activity: null, pomodoro: false, cycles: 0 };

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Restringe as apps escolhidas durante a sessão, através de um horário temporário do motor de regras. */
async function applyFocusRestriction(endAt: number | null) {
  const apps = usePrefs.getState().prefs.focusBlockedApps;
  if (endAt === null || apps.length === 0) {
    await deleteSchedule(FOCUS_SCHEDULE_ID);
  } else {
    const now = Date.now();
    await upsertSchedule({
      id: FOCUS_SCHEDULE_ID,
      label: 'Sessão de foco',
      enabled: true,
      start: hhmm(now),
      // +1 minuto para cobrir a granularidade ao minuto do motor.
      end: hhmm(endAt + 60_000),
      days: [new Date(now).getDay()],
      appIds: apps,
    });
  }
  await syncRulesToNative().catch(() => undefined);
}

export const useFocus = create<FocusStore>((set, get) => {
  const persist = async () => {
    const { timer, sessionId, notificationId, activity, pomodoro, cycles } = get();
    await kvSet<Persisted>(KEY, { timer, sessionId, notificationId, activity, pomodoro, cycles });
  };

  const finish = async (status: 'completed' | 'cancelled') => {
    const s = get();
    if (s.sessionId && s.timer.startedAt !== null && s.timer.phase === 'focus') {
      const actual = elapsedMs(s.timer, Date.now());
      const record = {
        id: s.sessionId,
        startedAt: s.timer.startedAt,
        endedAt: Date.now(),
        plannedMs: s.timer.durationMs,
        actualMs: actual,
        status,
        mode: s.pomodoro ? ('pomodoro' as const) : s.activity ? ('activity' as const) : ('timer' as const),
        activity: s.activity,
      };
      await saveFocusSession(record);
      await enqueueSync('focus_sessions', 'upsert', record.id, {
        id: record.id,
        started_at: new Date(record.startedAt).toISOString(),
        ended_at: new Date(record.endedAt).toISOString(),
        planned_ms: record.plannedMs,
        actual_ms: record.actualMs,
        status: record.status,
        mode: record.mode,
        activity: record.activity,
      });
    }
    await cancelNotification(s.notificationId);
  };

  return {
    ...initial,
    loaded: false,
    async load() {
      const stored = await kvGet<Persisted>(KEY, initial);
      set({ ...stored, loaded: true });
      await get().check();
    },
    async start(minutes, opts) {
      const now = Date.now();
      const timer = startTimer(minutes * 60_000, now, 'focus');
      const sessionId = randomUUID();
      await saveFocusSession({ id: sessionId, startedAt: now, endedAt: null, plannedMs: timer.durationMs, actualMs: 0, status: 'running', mode: opts?.pomodoro ? 'pomodoro' : opts?.activity ? 'activity' : 'timer', activity: opts?.activity ?? null });
      const notificationId = usePrefs.getState().prefs.notifications.focusEnd ? await scheduleFocusEnd(expectedEndAt(timer)!, 'focus') : null;
      set({ timer, sessionId, notificationId, activity: opts?.activity ?? null, pomodoro: !!opts?.pomodoro, cycles: get().pomodoro && opts?.pomodoro ? get().cycles : 0 });
      await applyFocusRestriction(expectedEndAt(timer));
      await persist();
    },
    async pause() {
      await cancelNotification(get().notificationId);
      set({ timer: pauseTimer(get().timer, Date.now()), notificationId: null });
      await applyFocusRestriction(null);
      await persist();
    },
    async resume() {
      const timer = resumeTimer(get().timer, Date.now());
      const notificationId = usePrefs.getState().prefs.notifications.focusEnd ? await scheduleFocusEnd(expectedEndAt(timer)!, timer.phase) : null;
      set({ timer, notificationId });
      if (timer.phase === 'focus') await applyFocusRestriction(expectedEndAt(timer));
      await persist();
    },
    async cancel() {
      await finish('cancelled');
      set({ ...initial, timer: { ...cancelTimer(get().timer), status: 'idle', startedAt: null } });
      await applyFocusRestriction(null);
      await persist();
    },
    async check() {
      const s = get();
      const next = tick(s.timer, Date.now());
      if (next.status !== 'completed' || s.timer.status === 'completed') return;
      await finish('completed');
      if (s.pomodoro) {
        const cycles = s.timer.phase === 'focus' ? s.cycles + 1 : s.cycles;
        const phase = nextPomodoroPhase(s.timer.phase, cycles);
        const timer = startTimer(phase.durationMs, Date.now(), phase.phase);
        const notificationId = await scheduleFocusEnd(expectedEndAt(timer)!, phase.phase);
        set({ timer, cycles, notificationId, sessionId: phase.phase === 'focus' ? randomUUID() : s.sessionId });
        await applyFocusRestriction(phase.phase === 'focus' ? expectedEndAt(timer) : null);
      } else {
        set({ timer: next, notificationId: null });
        await applyFocusRestriction(null);
      }
      await persist();
    },
  };
});
