/**
 * Segurança do assistente: detecção de sinais de crise ANTES de chamar o
 * modelo, e resposta fixa com recursos humanos de apoio. Sem dependências
 * (testado com Vitest em tests/functions).
 */

// Padrões escritos sem acentos: o texto é normalizado (minúsculas, sem diacríticos).
const CRISIS_PATTERNS: RegExp[] = [
  /\b(suicid\w*|matar-me|me matar|tirar a (minha )?vida|acabar com (a )?(minha )?vida)/,
  /\b(quero morrer|nao quero viver|sem razao para viver|nao aguento mais viver)/,
  /\b(automutila\w*|cortar-me|me cortar|fazer-me mal|me fazer mal|magoar-me|me magoar)/,
  /\b(overdose|tomar (os |todos os )?comprimidos)/,
];

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function detectCrisis(text: string): boolean {
  const normalized = normalizeText(text);
  return CRISIS_PATTERNS.some((r) => r.test(normalized));
}

export const CRISIS_REPLY =
  'Obrigado por me dizeres isto. O que estás a sentir é importante e não tens de passar por isto sozinho. ' +
  'Se estás em perigo ou a pensar fazer-te mal, liga já para o 112. ' +
  'Podes também falar com um profissional através do SNS 24 (808 24 24 24). ' +
  'Se puderes, contacta agora alguém de confiança e fica perto dessa pessoa. Eu sou apenas um assistente e não substituo ajuda profissional.';

/** Instruções de sistema — estáveis (para cache de prompt) e sem dados do utilizador. */
export const SYSTEM_PROMPT = `És o assistente do Acorde Já, uma aplicação de bem-estar digital ("Menos tela. Mais vida.").
Falas português europeu, tratas o utilizador por "tu", com tom calmo, caloroso e sem julgamento.

O teu papel:
- Ajudar a reduzir o uso compulsivo de aplicações, pornografia ou apostas, com estratégias práticas e voluntárias.
- Em momentos de impulso: validar o sentimento, propor uma pausa breve (respiração, mudar de divisão, beber água, caminhar) e uma actividade alternativa.
- Ajudar a criar planos de redução gradual realistas (pequenos passos semanais).
- Explicar estatísticas apenas com os números fornecidos no contexto. Se não houver números, diz que não os tens — nunca inventes dados.

Limites obrigatórios:
- Não és psicólogo nem médico: não fazes diagnósticos (por exemplo, não digas que alguém "tem uma dependência").
- Nunca envergonhas, culpas ou moralizas.
- Nunca incentivas apostas, nem dás dicas de jogo, nem formas de contornar bloqueios.
- Não podes alterar limites, bloqueios ou definições: se o utilizador pedir, explica onde o pode fazer na aplicação.
- Se surgirem sinais de crise, risco para a vida ou autolesão, recomenda ligar 112 ou o SNS 24 (808 24 24 24) e falar com alguém de confiança.
- Para apostas, podes mencionar a autoexclusão no SRIJ e a Linha Vida 1414.

Formato: respostas curtas (2 a 5 frases), sem listas longas, sem markdown pesado.
Quando fizer sentido sugerir um exercício, termina a resposta com uma destas etiquetas numa linha própria: [cartao:respiracao], [cartao:foco] ou [cartao:ajuda].`;

export type Card = 'breathing' | 'focus' | 'help';

/** Extrai as etiquetas de cartões da resposta do modelo e limpa o texto. */
export function extractCards(text: string): { text: string; cards: Card[] } {
  const map: Record<string, Card> = { respiracao: 'breathing', foco: 'focus', ajuda: 'help' };
  const cards: Card[] = [];
  const cleaned = text
    .replace(/\[cartao:(respiracao|foco|ajuda)\]/gi, (_, k: string) => {
      const c = map[k.toLowerCase()];
      if (c && !cards.includes(c)) cards.push(c);
      return '';
    })
    .trim();
  return { text: cleaned, cards };
}

/** Contexto mínimo e agregado enviado ao modelo. */
export function buildContextNote(ctx: { goals?: string[]; todayUsedMinutes?: number | null; todayLimitMinutes?: number | null } | undefined): string {
  if (!ctx) return 'Sem contexto adicional.';
  const goals = (ctx.goals ?? []).slice(0, 6).join(', ') || 'nenhum indicado';
  const usage =
    ctx.todayUsedMinutes != null && ctx.todayLimitMinutes != null
      ? `${ctx.todayUsedMinutes} de ${ctx.todayLimitMinutes} minutos permitidos nas apps controladas hoje`
      : 'sem dados de utilização de hoje';
  return `Objectivos do utilizador: ${goals}. Utilização: ${usage}.`;
}
