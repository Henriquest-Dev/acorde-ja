import { MINUTE, RuleState, nextLocalMidnight } from '@acorde/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useToday } from '@/hooks/queries';
import { launchApp, listLauncherApps, type LauncherApp } from '@/services/launcher';
import { usePrefs } from '@/stores/prefs';
import { useFocus } from '@/stores/focus';
import type { TodayAppState } from '@/services/usage';
import { toast } from '@/components';

export interface LauncherEntry extends LauncherApp {
  /** Limite aplicado a esta app (se existir). */
  limit: TodayAppState | null;
  locked: boolean;
  /** Texto curto do bloqueio, ex.: «até 00:00» ou «horário». */
  lockLabel: string | null;
  /** Texto de uso, ex.: «18 / 30 min». */
  usageLabel: string | null;
}

const ESSENTIALS = ['telefone', 'phone', 'mensagens', 'messages', 'whatsapp', 'câmara', 'camera', 'câmera', 'mapas', 'maps', 'spotify'];

export function useLauncher() {
  const prefs = usePrefs((s) => s.prefs.launcher);
  const today = useToday();
  const focus = useFocus();
  // O launcher é o primeiro ecrã: carrega o temporizador persistido (sessão de foco em curso).
  useEffect(() => {
    if (!focus.loaded) void focus.load();
  }, [focus]);
  const apps = useQuery({ queryKey: ['launcher-apps'], queryFn: listLauncherApps, staleTime: 5 * 60_000 });

  const limitFor = (pkg: string) => today.data?.apps.find((a) => a.packageNames.includes(pkg)) ?? null;
  const focusBlocked = usePrefs((s) => s.prefs.focusBlockedApps);
  const inFocus = focus.timer.status === 'running' && focus.timer.phase === 'focus';

  const entries: LauncherEntry[] = (apps.data ?? []).map((a) => {
    const limit = limitFor(a.packageName);
    const blocked = limit && (limit.state === RuleState.BLOCKED || limit.state === RuleState.SCHEDULED_BLOCK);
    const focusLock = inFocus && limit !== null && focusBlocked.includes(limit.appId);
    const locked = Boolean(blocked || focusLock);
    return {
      ...a,
      limit,
      locked,
      lockLabel: focusLock ? 'em foco' : limit?.state === RuleState.SCHEDULED_BLOCK ? 'horário' : blocked ? 'até 00:00' : null,
      usageLabel: limit && today.data?.measured ? `${Math.floor(limit.usedMs / MINUTE)} / ${limit.limitMinutes} min` : null,
    };
  });

  const visible = entries.filter((e) => !prefs.hidden.includes(e.packageName));
  const favorites = prefs.favorites.length
    ? prefs.favorites.map((p) => entries.find((e) => e.packageName === p)).filter((e): e is LauncherEntry => Boolean(e))
    : visible.filter((e) => ESSENTIALS.includes(e.label.toLowerCase())).slice(0, 6);

  /** Abre uma app respeitando bloqueios e a pausa de intenção. */
  const open = async (e: LauncherEntry) => {
    if (e.locked) {
      if (e.limit) router.push({ pathname: '/block', params: { appId: e.limit.appId } });
      else toast('Disponível depois do foco.');
      return;
    }
    if (e.limit && prefs.intentionSeconds > 0) {
      router.push({ pathname: '/launcher/pause', params: { pkg: e.packageName, label: e.label } });
      return;
    }
    const ok = await launchApp(e.packageName).catch(() => false);
    if (!ok) toast(`Não foi possível abrir ${e.label} neste dispositivo.`, 'error');
  };

  return {
    apps,
    entries,
    visible,
    favorites,
    open,
    inFocus,
    focusRemaining: focus.timer,
    usage: today.data,
    resetsAt: nextLocalMidnight(new Date()).getTime(),
  };
}
