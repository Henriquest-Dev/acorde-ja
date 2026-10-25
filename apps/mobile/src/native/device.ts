/**
 * Adaptador de plataforma: expõe uma interface comum ao resto do aplicativo e
 * ajusta-se automaticamente a Android, iOS e web. Quando o módulo nativo não
 * existe (web, Expo Go), devolve capacidades "não suportadas" — nunca dados
 * simulados.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  AcordeNative,
  type InstalledApp,
  type NativeCapabilities,
  type PermissionState,
  type PermissionStatus,
  type RestrictionStatus,
  type ShieldStats,
  type UsageQueryResult,
} from '../../modules/acorde-native';
import type { NativeRuleConfig } from '../../modules/acorde-native/src/AcordeNative.types';

export type { InstalledApp, NativeCapabilities, PermissionState, PermissionStatus, RestrictionStatus, ShieldStats, UsageQueryResult };

export const isNativeAvailable = AcordeNative !== null;

function unsupportedCapabilities(): NativeCapabilities {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    canMeasureUsage: false,
    canRestrictApps: false,
    canBlockSites: false,
    canListInstalledApps: false,
    enforcementRunning: false,
    shieldRunning: false,
    osVersion: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
    notes:
      Platform.OS === 'web'
        ? ['Na versão web não é possível medir nem bloquear aplicações. Instale o aplicativo Android ou iOS.']
        : ['Módulo nativo indisponível: utilize uma development build (npx expo run:android) em vez do Expo Go.'],
  };
}

export async function getCapabilities(): Promise<NativeCapabilities> {
  if (!AcordeNative) return unsupportedCapabilities();
  return AcordeNative.getNativeCapabilities();
}

async function notificationState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'not_determined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function getPermissions(): Promise<PermissionStatus> {
  const notifications = await notificationState();
  if (!AcordeNative) {
    return { usageAccess: 'unsupported', overlay: 'unsupported', notifications, vpn: 'unsupported', familyControls: 'unsupported' };
  }
  const status = await AcordeNative.getPermissionStatus();
  return { ...status, notifications };
}

export async function requestNotifications(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  const r = await Notifications.requestPermissionsAsync();
  return r.granted ? 'granted' : r.canAskAgain ? 'not_determined' : 'denied';
}

export async function requestUsageAccess(): Promise<void> {
  if (!AcordeNative) throw new NativeUnavailableError();
  if (Platform.OS === 'ios' && AcordeNative.requestFamilyControlsAuthorization) {
    await AcordeNative.requestFamilyControlsAuthorization();
    return;
  }
  await AcordeNative.requestUsagePermission();
}

export async function requestOverlay(): Promise<void> {
  if (!AcordeNative) throw new NativeUnavailableError();
  await AcordeNative.requestOverlayPermission();
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (!AcordeNative) return [];
  return AcordeNative.getInstalledApps();
}

export async function getUsage(startMs: number, endMs: number): Promise<UsageQueryResult | null> {
  if (!AcordeNative) return null;
  const caps = await AcordeNative.getNativeCapabilities();
  if (!caps.canMeasureUsage) return null;
  return AcordeNative.getUsageStats(startMs, endMs);
}

export async function pushRuleConfig(config: NativeRuleConfig): Promise<void> {
  if (!AcordeNative) return;
  await AcordeNative.setRuleConfig(JSON.stringify(config));
}

export async function getRestrictionStatus(): Promise<RestrictionStatus[]> {
  if (!AcordeNative) return [];
  return AcordeNative.getRestrictionStatus();
}

export async function startEnforcement(): Promise<boolean> {
  if (!AcordeNative) return false;
  return AcordeNative.startEnforcement();
}

export async function stopEnforcement(): Promise<void> {
  await AcordeNative?.stopEnforcement();
}

export async function goHome(): Promise<boolean> {
  if (!AcordeNative || Platform.OS !== 'android') return false;
  await AcordeNative.goHome();
  return true;
}

export interface NativeEvent {
  id: string;
  kind: string;
  appId: string | null;
  day: string;
  createdAt: number;
  meta: Record<string, unknown>;
}

export async function drainNativeEvents(): Promise<NativeEvent[]> {
  if (!AcordeNative) return [];
  try {
    return JSON.parse(await AcordeNative.drainEvents()) as NativeEvent[];
  } catch {
    return [];
  }
}

export async function openSystemSettings(kind: 'vpn' | 'private_dns' | 'notifications' | 'app') {
  if (!AcordeNative) throw new NativeUnavailableError();
  await AcordeNative.openSystemSettings(kind);
}

export async function presentIosAppPicker(): Promise<number | null> {
  if (!AcordeNative?.presentAppPicker) return null;
  return AcordeNative.presentAppPicker();
}

export const shield = {
  async prepare(): Promise<boolean> {
    if (!AcordeNative) return false;
    return AcordeNative.prepareShield();
  },
  async start(domains: string[], familyFilter: boolean): Promise<boolean> {
    if (!AcordeNative) return false;
    return AcordeNative.startShield(domains, familyFilter ? '1.1.1.3' : '1.1.1.1');
  },
  async stop(): Promise<void> {
    await AcordeNative?.stopShield();
  },
  async stats(): Promise<ShieldStats | null> {
    if (!AcordeNative) return null;
    return AcordeNative.getShieldStats();
  },
};

export class NativeUnavailableError extends Error {
  constructor() {
    super('Funcionalidade indisponível nesta plataforma ou sem development build.');
    this.name = 'NativeUnavailableError';
  }
}
