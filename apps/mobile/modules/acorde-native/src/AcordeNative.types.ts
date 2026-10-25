/**
 * Contrato tipado entre o React Native e os módulos nativos (Kotlin/Swift).
 * Todos os valores vêm do sistema operativo — nunca são estimados.
 */

export type PermissionState = 'granted' | 'denied' | 'not_determined' | 'unsupported';

export interface PermissionStatus {
  /** Android: PACKAGE_USAGE_STATS (Acesso a dados de utilização). iOS: autorização Screen Time. */
  usageAccess: PermissionState;
  /** Android: «Sobrepor a outras apps», usado para abrir o ecrã de bloqueio. */
  overlay: PermissionState;
  /** Notificações (avisos de limite). */
  notifications: PermissionState;
  /** Android: VPN local de filtragem DNS preparada (Digital Shield). iOS: n/d. */
  vpn: PermissionState;
  /** iOS: FamilyControls (Screen Time API). Android: unsupported. */
  familyControls: PermissionState;
}

export interface NativeCapabilities {
  platform: 'android' | 'ios' | 'web';
  /** O aplicativo consegue ler tempos de utilização por aplicação. */
  canMeasureUsage: boolean;
  /** O sistema consegue efectivamente impedir o uso de uma aplicação. */
  canRestrictApps: boolean;
  /** Filtragem de sites disponível neste dispositivo. */
  canBlockSites: boolean;
  canListInstalledApps: boolean;
  /** Serviço de aplicação de regras activo neste momento (Android). */
  enforcementRunning: boolean;
  shieldRunning: boolean;
  osVersion: string;
  /** Limitações conhecidas, em português, para mostrar ao utilizador. */
  notes: string[];
}

export interface InstalledApp {
  packageName: string;
  label: string;
  /** PNG em base64 (Android). */
  iconBase64: string | null;
  category: string | null;
}

export interface UsageStat {
  packageName: string;
  label: string;
  foregroundMs: number;
  /** Número de vezes que a app veio para primeiro plano; null se indisponível. */
  opens: number | null;
  lastUsedAt: number | null;
}

export interface UsageQueryResult {
  startMs: number;
  endMs: number;
  /** Soma do tempo em primeiro plano de todas as aplicações. */
  totalForegroundMs: number;
  apps: UsageStat[];
}

export interface NativeAppLimit {
  appId: string;
  packageNames: string[];
  limitMinutes: number;
  enabled: boolean;
  /** Epoch ms a partir do qual o limite conta. */
  sinceMs: number;
}

export interface NativeRuleConfig {
  limits: NativeAppLimit[];
  schedules: {
    id: string;
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
    appIds: string[];
  }[];
  strictMode: boolean;
  /** Notificações de aviso aos 80% e de bloqueio. */
  notify: boolean;
  exceptions: { appId: string; day: string; extraMinutes: number }[];
}

export interface RestrictionStatus {
  appId: string;
  state:
    | 'AVAILABLE'
    | 'WARNING'
    | 'BLOCKED'
    | 'TEMPORARY_EXCEPTION'
    | 'SCHEDULED_BLOCK'
    | 'PERMISSION_REQUIRED'
    | 'UNAVAILABLE';
  usedMs: number;
  limitMs: number;
}

export interface ShieldStats {
  running: boolean;
  blockedToday: number;
  domains: number;
  lastError: string | null;
  /** Epoch ms até ao qual o filtro não pode ser desligado (desafio); 0 = sem bloqueio. */
  lockedUntil: number;
}

/** Códigos de erro documentados que os módulos nativos podem lançar. */
export type NativeErrorCode =
  | 'ERR_PERMISSION_DENIED'
  | 'ERR_UNSUPPORTED'
  | 'ERR_INVALID_ARGUMENT'
  | 'ERR_SERVICE_START'
  | 'ERR_VPN_NOT_PREPARED'
  | 'ERR_FAMILY_CONTROLS';
