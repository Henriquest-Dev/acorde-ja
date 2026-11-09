/**
 * Assistente do offly fora do chat:
 *  - decide pedidos de tempo extra (Parallel Decisions no servidor, com as regras do offly por cima);
 *  - fala em voz alta nos momentos difíceis (Fish Audio no servidor).
 * Nenhuma chave de IA está no aplicativo: tudo passa pela Edge Function `coach`.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { usePrefs } from '@/stores/prefs';
import { getSupabase } from './supabase';

export type Decision = 'allow' | 'wait' | 'deny';
export type Requirement = 'none' | 'breathe' | 'habit' | 'focus';
export type ExtraReason = 'work' | 'study' | 'communication' | 'emergency' | 'other';

export interface DecisionInput {
  app: string;
  reason: ExtraReason;
  note?: string;
  limitMinutes: number | null;
  usedMinutes: number | null;
  requestsToday: number;
  challengeActive: boolean;
  habitsDue: number;
  habitsDone: number;
}

export interface DecisionResult {
  decision: Decision;
  requirement: Requirement;
  message: string;
  source: 'model' | 'rule' | 'fallback' | 'offline';
}

const firstName = () => {
  const n = usePrefs.getState().prefs.displayName.trim().split(/\s+/)[0] ?? '';
  return n.length >= 2 ? n : null;
};

/** Regras locais quando não há servidor (sem sessão ou sem rede): nunca mais permissivo que o servidor. */
export function offlineDecision(i: DecisionInput, name: string | null): DecisionResult {
  const hey = name ? `${name}, ` : '';
  if (i.challengeActive || i.requestsToday >= 3) {
    return { decision: 'deny', requirement: 'none', source: 'offline', message: `Calma, ${name ?? 'respira'}. Já chega de ${i.app} por hoje. Amanhã o tempo volta.` };
  }
  if (i.reason === 'emergency') return { decision: 'allow', requirement: 'none', source: 'offline', message: `Está bem${name ? `, ${name}` : ''}. Usa estes minutos com intenção.` };
  return { decision: 'wait', requirement: 'breathe', source: 'offline', message: `${hey}vamos respirar dois minutos antes. Se depois ainda precisares do ${i.app}, tudo bem.` };
}

export async function decideExtraTime(input: DecisionInput): Promise<DecisionResult> {
  const name = firstName();
  const sb = getSupabase();
  if (!sb) return offlineDecision(input, name);
  const { data: session } = await sb.auth.getSession();
  if (!session.session) return offlineDecision(input, name);
  try {
    const { data, error } = await sb.functions.invoke<DecisionResult>('coach', {
      body: { action: 'decide', ...input, hour: new Date().getHours(), name },
    });
    if (error || !data?.decision) return offlineDecision(input, name);
    return data;
  } catch {
    return offlineDecision(input, name);
  }
}

// --------------------------------------------------------------------------------- voz
export type VoiceMoment = 'intention' | 'limit' | 'relapse' | 'giveUp' | 'decision';

/** Frases faladas nos momentos difíceis (com o nome, quando o utilizador o indicou). */
export function voiceLine(moment: Exclude<VoiceMoment, 'decision'>, vars: { app?: string } = {}): string {
  const n = firstName();
  const app = vars.app ?? 'esta app';
  switch (moment) {
    case 'intention':
      return `Calma${n ? `, ${n}` : ''}. Respira. Precisas mesmo do ${app} agora?`;
    case 'limit':
      return `Chegaste ao teu limite${n ? `, ${n}` : ''}. Fizeste bem em parar. Amanhã o tempo volta.`;
    case 'relapse':
      return `Não desistas${n ? `, ${n}` : ''}. Uma recaída não apaga o caminho que já fizeste. Amanhã é um novo dia.`;
    case 'giveUp':
      return `Calma${n ? `, ${n}` : ''}. Lembra-te porque começaste. Este impulso passa.`;
  }
}

const cache = new Map<string, string>();
let current: AudioPlayer | null = null;
let modeSet = false;

function key(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `coach_${(h >>> 0).toString(36)}.mp3`;
}

/** Fala o texto com a voz do offly. Silencioso (sem erro) quando a voz está desligada ou indisponível. */
export async function speak(text: string): Promise<boolean> {
  if (!usePrefs.getState().prefs.voiceCoach || Platform.OS === 'web') return false;
  const sb = getSupabase();
  if (!sb) return false;
  try {
    let uri = cache.get(text);
    if (!uri) {
      const { data: session } = await sb.auth.getSession();
      if (!session.session) return false;
      const { data, error } = await sb.functions.invoke<{ audio: string }>('coach', { body: { action: 'speak', text } });
      if (error || !data?.audio) return false;
      const file = new File(Paths.cache, key(text));
      file.create({ overwrite: true });
      file.write(data.audio, { encoding: 'base64' });
      uri = file.uri;
      cache.set(text, uri);
    }
    if (!modeSet) {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      modeSet = true;
    }
    current?.remove();
    const player = createAudioPlayer({ uri });
    current = player;
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) {
        player.remove();
        if (current === player) current = null;
      }
    });
    player.play();
    return true;
  } catch {
    return false;
  }
}

export function sayMoment(moment: Exclude<VoiceMoment, 'decision'>, vars?: { app?: string }) {
  void speak(voiceLine(moment, vars));
}
