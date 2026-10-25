import { DEFAULT_RULE_SETTINGS, DEFAULT_SHIELD, type GoalId, type RuleSettings, type ShieldConfig } from '@acorde/core';
import { create } from 'zustand';
import { kvGet, kvSet } from '@/repositories/kv';
import type { ThemePreference } from '@/theme/ThemeProvider';

export interface Prefs {
  onboardingDone: boolean;
  goals: GoalId[];
  theme: ThemePreference;
  rules: RuleSettings;
  shield: ShieldConfig;
  notifications: {
    limitWarnings: boolean;
    focusEnd: boolean;
    habitReminders: boolean;
    weeklySummary: boolean;
  };
  biometricLock: boolean;
  /** Consentimento para sincronizar dados na nuvem (requer conta). */
  cloudSync: boolean;
  /** Consentimento específico para dados sensíveis (hábitos, objectivos de recuperação). */
  syncSensitive: boolean;
  /** Consentimento para usar o assistente IA (envio de mensagens para o servidor). */
  aiConsent: boolean;
  /** Permite ao assistente lembrar estratégias preferidas. */
  aiMemory: boolean;
  focus: {
    minutes: number;
    pomodoro: boolean;
    sound: 'none' | 'rain' | 'waves';
    weeklyGoalMinutes: number;
  };
  /** Ids das apps restringidas durante sessões de foco. */
  focusBlockedApps: string[];
}

export const DEFAULT_PREFS: Prefs = {
  onboardingDone: false,
  goals: [],
  theme: 'dark',
  rules: DEFAULT_RULE_SETTINGS,
  shield: DEFAULT_SHIELD,
  notifications: { limitWarnings: true, focusEnd: true, habitReminders: true, weeklySummary: true },
  biometricLock: false,
  cloudSync: false,
  syncSensitive: false,
  aiConsent: false,
  aiMemory: false,
  focus: { minutes: 25, pomodoro: false, sound: 'none', weeklyGoalMinutes: 300 },
  focusBlockedApps: [],
};

const KEY = 'prefs';

interface PrefsState {
  prefs: Prefs;
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)): Promise<void>;
  reset(): Promise<void>;
}

export const usePrefs = create<PrefsState>((set, get) => ({
  prefs: DEFAULT_PREFS,
  loaded: false,
  async load() {
    const stored = await kvGet<Partial<Prefs>>(KEY, {});
    // Merge profundo de primeiro nível para acolher novas chaves em actualizações.
    const prefs: Prefs = {
      ...DEFAULT_PREFS,
      ...stored,
      rules: { ...DEFAULT_PREFS.rules, ...stored.rules },
      shield: { ...DEFAULT_PREFS.shield, ...stored.shield, categories: { ...DEFAULT_PREFS.shield.categories, ...stored.shield?.categories } },
      notifications: { ...DEFAULT_PREFS.notifications, ...stored.notifications },
      focus: { ...DEFAULT_PREFS.focus, ...stored.focus },
    };
    set({ prefs, loaded: true });
  },
  async update(patch) {
    const current = get().prefs;
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
    set({ prefs: next });
    await kvSet(KEY, next);
  },
  async reset() {
    set({ prefs: DEFAULT_PREFS });
    await kvSet(KEY, DEFAULT_PREFS);
  },
}));
