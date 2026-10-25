import {
  addDays,
  dayKey,
  evaluateApp,
  startOfLocalDay,
  summarize,
  type AppRuleResult,
  type UsageDailyRow,
} from '@acorde/core';
import { randomUUID } from 'expo-crypto';
import {
  drainNativeEvents,
  getCapabilities,
  getPermissions,
  getHourlyUsage,
  getUsage,
  pushRuleConfig,
  type NativeCapabilities,
  type PermissionStatus,
} from '@/native/device';
import { kvGet, kvSet } from '@/repositories/kv';
import { listLimits, listSchedules, type AppLimit } from '@/repositories/limits';
import { SCREEN_TOTAL_ID, exceptionsForDay, insertEvents, replaceDay, usageBetween } from '@/repositories/usage';
import { usePrefs } from '@/stores/prefs';
import { enqueueSync } from './sync';

export async function getDeviceId(): Promise<string> {
  let id = await kvGet<string | null>('deviceId', null);
  if (!id) {
    id = randomUUID();
    await kvSet('deviceId', id);
  }
  return id;
}

/** Converte a medição do sistema em linhas diárias, associando pacotes às apps controladas. */
export function mapUsageToRows(
  day: string,
  apps: { packageName: string; label: string; foregroundMs: number; opens: number | null }[],
  totalForegroundMs: number,
  limits: AppLimit[],
): UsageDailyRow[] {
  const byId = new Map<string, UsageDailyRow>();
  for (const a of apps) {
    const limit = limits.find((l) => l.packageNames.includes(a.packageName));
    const appId = limit?.appId ?? a.packageName;
    const row = byId.get(appId) ?? {
      day,
      appId,
      appName: limit?.name ?? a.label,
      usedMs: 0,
      limitMs: limit ? limit.limitMinutes * 60_000 : null,
      opens: null,
    };
    row.usedMs += a.foregroundMs;
    if (a.opens !== null) row.opens = (row.opens ?? 0) + a.opens;
    byId.set(appId, row);
  }
  return [
    ...byId.values(),
    { day, appId: SCREEN_TOTAL_ID, appName: 'Tempo de ecrã', usedMs: totalForegroundMs, limitMs: null, opens: null },
  ];
}

async function measureDay(date: Date, end: Date, limits: AppLimit[]): Promise<boolean> {
  const res = await getUsage(startOfLocalDay(date).getTime(), end.getTime());
  if (!res) return false;
  const day = dayKey(date);
  const rows = mapUsageToRows(day, res.apps, res.totalForegroundMs, limits);
  await replaceDay(day, rows);
  const deviceId = await getDeviceId();
  for (const r of rows.filter((x) => limits.some((l) => l.appId === x.appId) || x.appId === SCREEN_TOTAL_ID)) {
    await enqueueSync('usage_daily', 'upsert', `${day}:${r.appId}`, {
      device_id: deviceId,
      day,
      app_id: r.appId,
      app_name: r.appName,
      used_ms: Math.round(r.usedMs),
      limit_ms: r.limitMs,
      opens: r.opens,
    });
  }
  return true;
}

/**
 * Lê a utilização real do sistema para hoje e, uma vez por dia, preenche os
 * 7 dias anteriores (o Android guarda eventos detalhados durante ~7 dias).
 */
export async function refreshUsage(now = new Date()): Promise<{ measured: boolean }> {
  const limits = await listLimits();
  const measured = await measureDay(now, now, limits);
  if (!measured) return { measured: false };
  const today = dayKey(now);
  if ((await kvGet<string | null>('backfilledOn', null)) !== today) {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(startOfLocalDay(now), -i);
      await measureDay(d, addDays(d, 1), limits);
    }
    await kvSet('backfilledOn', today);
  }
  const events = await drainNativeEvents();
  await insertEvents(events);
  for (const e of events) {
    await enqueueSync('block_events', 'append', e.id, { id: e.id, app_id: e.appId, kind: e.kind, day: e.day, created_at: new Date(e.createdAt).toISOString() });
  }
  return { measured: true };
}

/** Envia a configuração actual das regras para o serviço nativo. */
export async function syncRulesToNative(now = new Date()): Promise<void> {
  const [limits, schedules, exceptions] = await Promise.all([listLimits(), listSchedules(), exceptionsForDay(dayKey(now))]);
  const { rules, notifications } = usePrefs.getState().prefs;
  await pushRuleConfig({
    limits: limits.map((l) => ({ appId: l.appId, packageNames: l.packageNames, limitMinutes: l.limitMinutes, enabled: l.enabled, sinceMs: l.sinceMs })),
    schedules: schedules.map(({ label: _label, ...s }) => s),
    strictMode: rules.strictMode,
    notify: notifications.limitWarnings,
    exceptions: exceptions.map((e) => ({ appId: e.appId, day: e.day, extraMinutes: e.extraMinutes })),
  });
}

export interface TodayAppState extends AppRuleResult {
  name: string;
  packageNames: string[];
  limitMinutes: number;
  /** Se o limite só começou a contar hoje, a hora a partir da qual conta. */
  countingSince: number | null;
}

export interface TodaySnapshot {
  measured: boolean;
  capabilities: NativeCapabilities;
  permissions: PermissionStatus;
  apps: TodayAppState[];
  totals: ReturnType<typeof summarize>;
  screenTimeMs: number | null;
  updatedAt: number;
}

export async function loadToday(now = new Date()): Promise<TodaySnapshot> {
  const [capabilities, permissions] = await Promise.all([getCapabilities(), getPermissions()]);
  let measured = false;
  if (capabilities.canMeasureUsage) measured = (await refreshUsage(now)).measured;
  const day = dayKey(now);
  const [limits, schedules, exceptions, rows] = await Promise.all([
    listLimits(),
    listSchedules(),
    exceptionsForDay(day),
    measured ? usageBetween(day, day) : Promise.resolve([] as UsageDailyRow[]),
  ]);
  const capability = {
    canMeasure: capabilities.canMeasureUsage,
    canRestrict: capabilities.canRestrictApps,
    permissionGranted: measured,
  };
  // O limite só conta a partir do momento em que passou a valer: o uso anterior
  // (por exemplo, antes de instalar o Acorde Já) não o esgota.
  const dayStart = startOfLocalDay(now).getTime();
  const windows = new Map<number, Awaited<ReturnType<typeof getUsage>>>();
  if (measured) {
    for (const since of new Set(limits.filter((l) => l.sinceMs > dayStart).map((l) => l.sinceMs))) {
      windows.set(since, await getUsage(since, now.getTime()));
    }
  }
  const usedFor = (l: (typeof limits)[number]) => {
    const win = l.sinceMs > dayStart ? windows.get(l.sinceMs) : undefined;
    if (win) return win.apps.filter((a) => l.packageNames.includes(a.packageName)).reduce((s, a) => s + a.foregroundMs, 0);
    return rows.find((r) => r.appId === l.appId)?.usedMs ?? 0;
  };
  const apps: TodayAppState[] = limits.map((l) => {
    const result = evaluateApp(
      {
        appId: l.appId,
        limitMinutes: l.limitMinutes,
        enabled: l.enabled,
        usedMs: measured ? usedFor(l) : null,
        exceptionsToday: exceptions.filter((e) => e.appId === l.appId),
      },
      { capability, schedules, now },
    );
    return { ...result, name: l.name, packageNames: l.packageNames, limitMinutes: l.limitMinutes, countingSince: l.sinceMs > dayStart ? l.sinceMs : null };
  });
  const screen = rows.find((r) => r.appId === SCREEN_TOTAL_ID);
  return {
    measured,
    capabilities,
    permissions,
    apps,
    totals: summarize(apps),
    screenTimeMs: measured ? (screen?.usedMs ?? 0) : null,
    updatedAt: now.getTime(),
  };
}

/** Tempo de ecrã total por hora de hoje (24 valores em ms) — dados reais do sistema. */
export async function loadHourly(now = new Date()): Promise<number[] | null> {
  const caps = await getCapabilities();
  if (!caps.canMeasureUsage) return null;
  return getHourlyUsage(startOfLocalDay(now).getTime());
}
