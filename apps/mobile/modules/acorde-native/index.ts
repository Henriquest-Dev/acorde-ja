import { requireOptionalNativeModule } from 'expo-modules-core';
import type {
  InstalledApp,
  NativeCapabilities,
  PermissionStatus,
  RestrictionStatus,
  ShieldStats,
  UsageQueryResult,
} from './src/AcordeNative.types';

export * from './src/AcordeNative.types';

/** Interface implementada em Kotlin (Android) e Swift (iOS). */
export interface AcordeNativeModule {
  getNativeCapabilities(): Promise<NativeCapabilities>;
  getPermissionStatus(): Promise<PermissionStatus>;
  /** Abre o ecrã do sistema para conceder acesso. O estado deve ser relido ao regressar. */
  requestUsagePermission(): Promise<void>;
  requestOverlayPermission(): Promise<void>;
  getInstalledApps(): Promise<InstalledApp[]>;
  getUsageStats(startMs: number, endMs: number): Promise<UsageQueryResult>;
  /** Configuração completa das regras, serializada em JSON (ver NativeRuleConfig). */
  setRuleConfig(configJson: string): Promise<void>;
  setAppLimit(appId: string, packageNames: string[], limitMinutes: number, enabled: boolean): Promise<void>;
  getAppLimit(appId: string): Promise<{ appId: string; limitMinutes: number; enabled: boolean } | null>;
  removeAppLimit(appId: string): Promise<void>;
  getRestrictionStatus(): Promise<RestrictionStatus[]>;
  startEnforcement(): Promise<boolean>;
  stopEnforcement(): Promise<void>;
  /** Envia o utilizador para o ecrã inicial do sistema (botão «Fechar app»). */
  goHome(): Promise<void>;
  /** Eventos registados pelo serviço nativo desde a última leitura (JSON). */
  drainEvents(): Promise<string>;
  openSystemSettings(kind: 'vpn' | 'private_dns' | 'notifications' | 'app'): Promise<void>;
  // Digital Shield (Android: VPN local de DNS).
  prepareShield(): Promise<boolean>;
  /** `upstream`: "1.1.1.1" (padrão) ou "1.1.1.3" (Cloudflare for Families, filtra conteúdo adulto). */
  startShield(domains: string[], upstream: string): Promise<boolean>;
  stopShield(): Promise<void>;
  getShieldStats(): Promise<ShieldStats>;
  /** Compromisso do desafio: o filtro não pode ser desligado até `untilMs` (só pode ser prolongado). */
  setShieldLock(untilMs: number): Promise<number>;
  /** Tempo de ecrã total por hora (24 valores, ms) desde `dayStartMs`. */
  getHourlyUsage(dayStartMs: number): Promise<number[]>;
  // iOS (FamilyControls)
  requestFamilyControlsAuthorization?(): Promise<PermissionStatus['familyControls']>;
  presentAppPicker?(): Promise<number>;
}

/** `null` em web, Expo Go ou quando o módulo não foi compilado. */
export const AcordeNative = requireOptionalNativeModule<AcordeNativeModule>('AcordeNative');
