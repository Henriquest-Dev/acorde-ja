import type { Habit } from '@acorde/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('focus', {
      name: 'Modo foco',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    void Notifications.setNotificationChannelAsync('habits', {
      name: 'Lembretes de hábitos',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

async function canNotify() {
  if (Platform.OS === 'web') return false;
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/** Agenda a notificação de fim da sessão de foco (funciona com o app fechado). */
export async function scheduleFocusEnd(endAt: number, phase: 'focus' | 'break'): Promise<string | null> {
  if (!(await canNotify()) || endAt <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: phase === 'focus' ? 'Sessão de foco concluída' : 'Pausa terminada',
      body: phase === 'focus' ? 'Bom trabalho. Faça uma pausa curta longe do ecrã.' : 'Pronto para mais um bloco de foco?',
      data: { url: 'acordeja://focus' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endAt), channelId: 'focus' },
  });
}

export async function cancelNotification(id: string | null | undefined) {
  if (!id || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

/** Agenda lembretes semanais/diários de um hábito; devolve os ids agendados. */
export async function scheduleHabitReminders(habit: Habit): Promise<string[]> {
  if (!habit.reminderTime || !(await canNotify())) return [];
  const [hour, minute] = habit.reminderTime.split(':').map(Number) as [number, number];
  const content = { title: habit.title, body: 'Um pequeno passo hoje conta.', data: { url: 'acordeja://habits' } };
  if (habit.frequency.kind === 'weekdays') {
    return Promise.all(
      habit.frequency.days.map((d) =>
        Notifications.scheduleNotificationAsync({
          content,
          // expo-notifications usa 1 = domingo … 7 = sábado.
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: 'habits' },
        }),
      ),
    );
  }
  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'habits' },
  });
  return [id];
}
