import { usePrefs } from '@/stores/prefs';
import { getSupabase } from './supabase';

export interface AssistantReply {
  reply: string;
  conversationId: string;
  /** Cartões sugeridos pelo servidor (ex.: exercício de respiração). */
  cards: ('breathing' | 'focus' | 'help')[];
  /** Verdadeiro quando o servidor detectou sinais de crise e respondeu com recursos de apoio. */
  crisis: boolean;
}

export class AssistantUnavailableError extends Error {
  constructor(public readonly reason: 'no_backend' | 'no_session' | 'rate_limited' | 'network' | 'server') {
    super(reason);
    this.name = 'AssistantUnavailableError';
  }
}

/**
 * Envia uma mensagem ao assistente através da Edge Function `assistant`.
 * A chave do modelo de IA nunca está no aplicativo. O contexto enviado é
 * mínimo e agregado (objectivos e minutos de hoje).
 */
export async function sendToAssistant(params: {
  conversationId: string | null;
  message: string;
  todayUsedMinutes: number | null;
  todayLimitMinutes: number | null;
}): Promise<AssistantReply> {
  const sb = getSupabase();
  if (!sb) throw new AssistantUnavailableError('no_backend');
  const { data: session } = await sb.auth.getSession();
  if (!session.session) throw new AssistantUnavailableError('no_session');
  const { goals } = usePrefs.getState().prefs;
  const { data, error, response } = await sb.functions.invoke<AssistantReply>('assistant', {
    body: {
      conversationId: params.conversationId,
      message: params.message,
      context: { goals, todayUsedMinutes: params.todayUsedMinutes, todayLimitMinutes: params.todayLimitMinutes },
    },
  });
  if (error || !data) {
    const status = response?.status;
    if (status === 429) throw new AssistantUnavailableError('rate_limited');
    if (!status) throw new AssistantUnavailableError('network');
    throw new AssistantUnavailableError('server');
  }
  return data;
}
