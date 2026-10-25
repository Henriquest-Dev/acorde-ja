import type { GoalId } from '@acorde/core';
import type { RowIcon } from '@/components';

export const GOAL_ICONS: Record<GoalId, RowIcon> = {
  reduce_social: { set: 'mci', name: 'gesture-tap' },
  avoid_porn: { set: 'mci', name: 'cancel' },
  avoid_gambling: { set: 'mci', name: 'close-box-outline' },
  focus: { set: 'mci', name: 'circle-half-full' },
  sleep: { set: 'mci', name: 'weather-night' },
  healthy_habits: { set: 'mci', name: 'chart-pie' },
};
