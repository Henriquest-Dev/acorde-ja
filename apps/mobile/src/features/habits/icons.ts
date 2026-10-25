import type { RowIcon } from '@/components';

/** Ícones disponíveis para hábitos (monocromáticos). */
export const HABIT_ICONS: Record<string, RowIcon> = {
  'book-open': { set: 'feather', name: 'book-open' },
  activity: { set: 'mci', name: 'run' },
  meditate: { set: 'mci', name: 'meditation' },
  water: { set: 'mci', name: 'cup-water' },
  'edit-3': { set: 'feather', name: 'edit-3' },
  moon: { set: 'mci', name: 'weather-night' },
  study: { set: 'mci', name: 'school-outline' },
  walk: { set: 'mci', name: 'walk' },
  heart: { set: 'feather', name: 'heart' },
  sun: { set: 'feather', name: 'sun' },
};

export const habitIcon = (key: string): RowIcon => HABIT_ICONS[key] ?? { set: 'feather', name: 'circle' };
