/** Esquemas Zod partilhados entre o aplicativo, as Edge Functions e o admin. */

import { z } from 'zod';
import { LIMIT_MAX_MINUTES, LIMIT_MIN_MINUTES } from './catalog';

export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM');

export const appLimitSchema = z.object({
  appId: z.string().min(1),
  limitMinutes: z
    .number()
    .int('Use minutos inteiros')
    .min(LIMIT_MIN_MINUTES, `Mínimo de ${LIMIT_MIN_MINUTES} minuto`)
    .max(LIMIT_MAX_MINUTES, 'Máximo de 12 horas'),
  enabled: z.boolean(),
});

export const blockScheduleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  start: timeOfDaySchema,
  end: timeOfDaySchema,
  days: z.array(z.number().int().min(0).max(6)).min(1, 'Escolha pelo menos um dia'),
  appIds: z.array(z.string()),
});

export const habitFormSchema = z.object({
  title: z.string().trim().min(2, 'Dê um nome ao hábito').max(60, 'Máximo de 60 caracteres'),
  icon: z.string().min(1),
  target: z.string().trim().max(40).nullable(),
  frequency: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('daily') }),
    z.object({ kind: z.literal('weekdays'), days: z.array(z.number().int().min(0).max(6)).min(1, 'Escolha os dias') }),
    z.object({ kind: z.literal('times_per_week'), times: z.number().int().min(1).max(7) }),
  ]),
  reminderTime: timeOfDaySchema.nullable(),
});
export type HabitForm = z.infer<typeof habitFormSchema>;

export const emailSchema = z.string().trim().toLowerCase().email('Email inválido');
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número');

export const signUpSchema = z
  .object({ email: emailSchema, password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As palavras-passe não coincidem' });

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Indique a palavra-passe') });

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Indique o assunto').max(120),
  message: z.string().trim().min(10, 'Descreva o problema (mín. 10 caracteres)').max(4000),
});

export const assistantMessageSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().trim().min(1).max(2000),
  /** Contexto mínimo e agregado — nunca listas de sites ou conteúdos. */
  context: z
    .object({
      goals: z.array(z.string()).max(6),
      todayUsedMinutes: z.number().int().min(0).max(1440).nullable(),
      todayLimitMinutes: z.number().int().min(0).max(1440).nullable(),
    })
    .optional(),
});
