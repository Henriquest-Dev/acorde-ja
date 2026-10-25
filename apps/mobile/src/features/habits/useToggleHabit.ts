import { toggleEntry, type HabitEntry } from '@acorde/core';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { qk, useInvalidate } from '@/hooks/queries';
import { addEntry, removeEntry } from '@/repositories/habits';
import { enqueueSync } from '@/services/sync';

/** Marca/desmarca um hábito num dia, persistindo e enfileirando a sincronização. */
export function useToggleHabit() {
  const invalidate = useInvalidate();
  return async (entries: HabitEntry[], habitId: string, day: string) => {
    const r = toggleEntry(entries, habitId, day, randomUUID, Date.now());
    if (r.added) {
      await addEntry(r.added);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await enqueueSync('habit_entries', 'append', r.added.id, {
        id: r.added.id,
        habit_id: habitId,
        day,
        completed_at: new Date(r.added.completedAt).toISOString(),
      });
    }
    if (r.removed) {
      await removeEntry(r.removed.id);
      await enqueueSync('habit_entries', 'delete', r.removed.id, {});
    }
    await invalidate(qk.habits);
  };
}
