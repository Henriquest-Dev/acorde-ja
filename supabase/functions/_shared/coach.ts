// Assistente do offly: conversa (Nemotron), decisão (Parallel Decisions) e voz (Fish Audio),
// todos através do OpenRouter. Lógica pura, testada em tests/functions/coach.test.ts.

export const CHAT_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
export const DECISION_MODEL = 'parallel/decisions-fast:free';
export const VOICE_MODEL = 'fish-audio/s2.1-pro-free:free';
export const OPENROUTER = 'https://openrouter.ai';

export type Decision = 'allow' | 'wait' | 'deny';
export type Requirement = 'none' | 'breathe' | 'habit' | 'focus';
export type ExtraReason = 'work' | 'study' | 'communication' | 'emergency' | 'other';

export interface DecisionContext {
  app: string;
  reason: ExtraReason;
  /** Texto livre opcional do utilizador (curto). */
  note?: string;
  limitMinutes: number | null;
  usedMinutes: number | null;
  /** Pedidos de tempo extra já feitos hoje (para esta app). */
  requestsToday: number;
  /** Hora local 0–23. */
  hour: number;
  challengeActive: boolean;
  habitsDue: number;
  habitsDone: number;
  name?: string | null;
}

export interface DecisionResult {
  decision: Decision;
  requirement: Requirement;
  confidence: number;
  /** De onde veio a decisão: modelo, regra fixa ou falha do modelo. */
  source: 'model' | 'rule' | 'fallback';
  message: string;
}

const REASON_LABEL: Record<ExtraReason, string> = {
  work: 'trabalho',
  study: 'estudo',
  communication: 'falar com alguém',
  emergency: 'emergência',
  other: 'outro motivo',
};

export function cleanName(name: string | null | undefined): string | null {
  const n = String(name ?? '').replace(/[^\p{L}\p{M}' -]/gu, '').trim().slice(0, 24);
  return n.length >= 2 ? n : null;
}

/** Pedido para /api/alpha/decisions: o modelo escolhe a decisão e a condição a cumprir. */
export function buildDecisionRequest(ctx: DecisionContext) {
  return {
    model: DECISION_MODEL,
    questions: {
      decision: {
        type: 'choice',
        instructions:
          'Uma pessoa definiu um limite diário para uma app no offly e chegou ao fim desse tempo. Agora pede mais tempo. ' +
          'O offly está do lado dela a longo prazo: ajuda-a a cumprir o que ela própria decidiu. Escolhe a resposta.',
        criteria: {
          allow: 'O motivo é concreto e necessário (trabalho, estudo, comunicação importante, emergência) e é o primeiro ou segundo pedido de hoje.',
          wait: 'O motivo é vago ou parece impulso, mas não é grave: pedir primeiro uma pausa curta de respiração.',
          deny: 'É claramente um impulso, uma repetição (muitos pedidos hoje) ou é tarde da noite sem motivo concreto.',
        },
      },
      requirement: {
        type: 'choice',
        instructions: 'Antes de dar mais tempo, que pequena tarefa saudável faz sentido pedir primeiro?',
        criteria: {
          none: 'Nada: o motivo é urgente ou já fez o que tinha a fazer hoje.',
          breathe: 'Uma pausa de respiração de 2 minutos.',
          habit: 'Concluir primeiro um dos hábitos que ainda tem por fazer hoje.',
          focus: 'Fazer primeiro 10 minutos de foco (estudo ou trabalho) longe do telemóvel.',
        },
      },
    },
    state: {
      app: ctx.app.slice(0, 40),
      motivo: REASON_LABEL[ctx.reason] ?? 'outro motivo',
      nota: (ctx.note ?? '').slice(0, 200),
      limite_minutos: ctx.limitMinutes,
      usados_minutos: ctx.usedMinutes,
      pedidos_extra_hoje: ctx.requestsToday,
      hora_local: ctx.hour,
      habitos_por_fazer_hoje: Math.max(0, ctx.habitsDue - ctx.habitsDone),
    },
  };
}

type AnswerChoice = { choice?: string; confidence?: number };

/** Lê a resposta do modelo e aplica as regras do produto (que têm sempre a última palavra). */
export function decide(ctx: DecisionContext, response: unknown): DecisionResult {
  const answers = (response as { answers?: Record<string, AnswerChoice> } | null)?.answers ?? {};
  const rawD = answers.decision?.choice;
  const rawR = answers.requirement?.choice;
  let decision: Decision = rawD === 'allow' || rawD === 'wait' || rawD === 'deny' ? rawD : 'wait';
  let requirement: Requirement = rawR === 'none' || rawR === 'breathe' || rawR === 'habit' || rawR === 'focus' ? rawR : 'breathe';
  let source: DecisionResult['source'] = rawD ? 'model' : 'fallback';
  const confidence = typeof answers.decision?.confidence === 'number' ? answers.decision.confidence : 0;

  // Regras fixas do offly (o modelo não as pode contornar).
  if (ctx.challengeActive) {
    decision = 'deny';
    requirement = 'none';
    source = 'rule';
  } else if (ctx.requestsToday >= 3) {
    decision = 'deny';
    requirement = 'none';
    source = 'rule';
  } else if (ctx.reason === 'emergency') {
    decision = 'allow';
    requirement = 'none';
    source = 'rule';
  }
  if (requirement === 'habit' && ctx.habitsDue - ctx.habitsDone <= 0) requirement = 'breathe';
  if (decision === 'deny') requirement = 'none';
  return { decision, requirement, confidence, source, message: decisionMessage(decision, requirement, ctx) };
}

export function decisionMessage(d: Decision, r: Requirement, ctx: Pick<DecisionContext, 'app' | 'name' | 'challengeActive'>): string {
  const n = cleanName(ctx.name);
  const hey = n ? `${n}, ` : '';
  if (d === 'deny') {
    if (ctx.challengeActive) return `${hey}estás num desafio e prometeste a ti mesmo não voltar ao ${ctx.app} hoje. Calma. Este impulso passa. Respira comigo.`;
    return `Calma, ${n ?? 'respira'}. Será que precisas mesmo disto agora? Já chega de ${ctx.app} por hoje. Amanhã o tempo volta.`;
  }
  if (r === 'habit') return `${hey}primeiro, marca um dos teus hábitos de hoje. Depois falamos do ${ctx.app}.`;
  if (r === 'focus') return `${hey}faz primeiro dez minutos de foco, longe do telemóvel. Se ainda precisares, eu deixo-te voltar.`;
  if (d === 'wait' || r === 'breathe') return `${hey}vamos respirar dois minutos antes. Se depois ainda precisares do ${ctx.app}, tudo bem.`;
  return `Está bem${n ? `, ${n}` : ''}. Uns minutos para o que precisas. Usa-os com intenção.`;
}

/** Texto curto e seguro para a voz. */
export function speechText(text: string): string {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 320);
}

export function chatBody(system: string, messages: { role: 'user' | 'assistant'; content: string }[]) {
  return {
    model: CHAT_MODEL,
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: 1500,
    temperature: 0.6,
    // Modelo com raciocínio: pouco esforço e sem devolver o raciocínio (custo e latência).
    reasoning: { effort: 'low', exclude: true },
  };
}

export function speechBody(text: string) {
  return { model: VOICE_MODEL, input: speechText(text), response_format: 'mp3' };
}
