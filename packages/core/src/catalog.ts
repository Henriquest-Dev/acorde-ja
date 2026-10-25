/**
 * Catálogo de objectivos e limites iniciais apresentados no onboarding.
 */

export type GoalId =
  | 'reduce_social'
  | 'avoid_porn'
  | 'avoid_gambling'
  | 'focus'
  | 'sleep'
  | 'healthy_habits';

export interface Goal {
  id: GoalId;
  label: string;
}

/** Mesma ordem e textos do ecrã «Quais são os seus principais objetivos?». */
export const GOALS: readonly Goal[] = [
  { id: 'reduce_social', label: 'Reduzir tempo nas redes sociais' },
  { id: 'avoid_porn', label: 'Evitar pornografia' },
  { id: 'avoid_gambling', label: 'Evitar apostas' },
  { id: 'focus', label: 'Ter mais foco e produtividade' },
  { id: 'sleep', label: 'Dormir melhor' },
  { id: 'healthy_habits', label: 'Criar hábitos saudáveis' },
];

export type KnownAppId = 'instagram' | 'tiktok' | 'facebook' | 'youtube';

export interface CatalogApp {
  id: KnownAppId;
  name: string;
  /** Pacotes Android correspondentes (inclui variantes oficiais). */
  androidPackages: string[];
  defaultLimitMinutes: number;
  category: 'social' | 'video';
}

export const DEFAULT_APPS: readonly CatalogApp[] = [
  { id: 'instagram', name: 'Instagram', androidPackages: ['com.instagram.android'], defaultLimitMinutes: 30, category: 'social' },
  {
    id: 'tiktok',
    name: 'TikTok',
    androidPackages: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
    defaultLimitMinutes: 20,
    category: 'social',
  },
  { id: 'facebook', name: 'Facebook', androidPackages: ['com.facebook.katana', 'com.facebook.lite'], defaultLimitMinutes: 20, category: 'social' },
  { id: 'youtube', name: 'YouTube', androidPackages: ['com.google.android.youtube'], defaultLimitMinutes: 40, category: 'video' },
];

export function findCatalogAppByPackage(pkg: string): CatalogApp | undefined {
  return DEFAULT_APPS.find((a) => a.androidPackages.includes(pkg));
}

export const LIMIT_MIN_MINUTES = 1;
export const LIMIT_MAX_MINUTES = 12 * 60;
