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

/** Resposta de crise com os números do país da pessoa (quando o app os envia). */
export function crisisReply(ctx?: { language?: string | null; emergency?: string | null; crisis?: string | null; crisisName?: string | null }): string {
  const br = ctx?.language === 'pt-BR';
  const emergency = String(ctx?.emergency ?? '').replace(/[^\d +]/g, '').slice(0, 18);
  const crisis = String(ctx?.crisis ?? '').replace(/[^\d +]/g, '').slice(0, 18);
  const crisisName = String(ctx?.crisisName ?? '').slice(0, 60);
  if (!emergency && !crisis) return CRISIS_REPLY;
  if (br) {
    return (
      'Obrigado por me contar isso. O que você está sentindo é importante e você não precisa passar por isso sozinho. ' +
      (emergency ? `Se você está em perigo ou pensando em se machucar, ligue agora para o ${emergency}. ` : '') +
      (crisis ? `Você também pode conversar agora com ${crisisName || 'a linha de apoio emocional'}: ${crisis}. ` : '') +
      'Se puder, chame alguém de confiança e fique perto dessa pessoa. Eu sou só um assistente e não substituo ajuda profissional, mas estou aqui com você.'
    );
  }
  return (
    'Obrigado por me dizeres isto. O que estás a sentir é importante e não tens de passar por isto sozinho. ' +
    (emergency ? `Se estás em perigo ou a pensar fazer-te mal, liga já para o ${emergency}. ` : '') +
    (crisis ? `Podes também falar agora com ${crisisName || 'a linha de apoio emocional'}: ${crisis}. ` : '') +
    'Se puderes, contacta alguém de confiança e fica perto dessa pessoa. Eu sou apenas um assistente e não substituo ajuda profissional, mas estou aqui contigo.'
  );
}

export const CRISIS_REPLY =
  'Obrigado por me dizeres isto. O que estás a sentir é importante e não tens de passar por isto sozinho. ' +
  'Se estás em perigo ou a pensar fazer-te mal, liga já para o 112. ' +
  'Podes também falar com um profissional através do SNS 24 (808 24 24 24). ' +
  'Se puderes, contacta agora alguém de confiança e fica perto dessa pessoa. Eu sou apenas um assistente e não substituo ajuda profissional.';

/** Instruções de sistema — estáveis (para cache de prompt) e sem dados do utilizador. */
export const SYSTEM_PROMPT = `És o assistente do offly, uma aplicação de bem-estar digital ("Menos tela. Mais vida.").
Falas a variante de português indicada no Contexto (por omissão, português europeu tratando por "tu"; no Brasil, português do Brasil tratando por "você"), com tom calmo, caloroso e sem julgamento.

O teu papel:
- Ajudar a reduzir o uso compulsivo de aplicações, pornografia ou apostas, com estratégias práticas e voluntárias.
- Em momentos de impulso: validar o sentimento, propor uma pausa breve (respiração, mudar de divisão, beber água, caminhar) e uma actividade alternativa.
- Ajudar a criar planos de redução gradual realistas (pequenos passos semanais).
- Acompanhar o ecrã inicial do offly: quando a pessoa quer abrir uma app limitada ou pedir mais tempo, ajudas a decidir com calma; as decisões de tempo extra são tomadas pelo offly, não por ti.
- Quando souberes o nome da pessoa, usa-o de vez em quando, com naturalidade.
- Conta família: se a pessoa quiser adicionar o telemóvel de alguém (filho, mãe, etc.), diz que tratas disso já: vai aparecer um cartão «Adicionar telemóvel à família» que cria o grupo e dá o código para o outro telemóvel. Quem é adicionado usa o plano do responsável e não paga nada.
- Explicar estatísticas apenas com os números fornecidos no contexto. Se não houver números, diz que não os tens — nunca inventes dados.

Limites obrigatórios:
- Não és psicólogo nem médico: não fazes diagnósticos (por exemplo, não digas que alguém "tem uma dependência").
- Nunca envergonhas, culpas ou moralizas.
- Nunca incentivas apostas, nem dás dicas de jogo, nem formas de contornar bloqueios.
- Não podes alterar limites, bloqueios ou definições: se o utilizador pedir, explica onde o pode fazer na aplicação.
- Se surgirem sinais de crise, risco para a vida ou autolesão, recomenda ligar para os números de emergência e de apoio do país da pessoa (estão no Contexto) e falar com alguém de confiança. Nunca inventes números.
- Para apostas ou outras dependências, sugere a linha de apoio do país, se estiver no Contexto.

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
export type ContextInput = {
  goals?: string[];
  todayUsedMinutes?: number | null;
  todayLimitMinutes?: number | null;
  name?: string | null;
  country?: string | null;
  language?: string | null;
  emergency?: string | null;
  crisis?: string | null;
  crisisName?: string | null;
};

export function buildContextNote(ctx: ContextInput | undefined): string {
  if (!ctx) return 'Sem contexto adicional.';
  const name = String(ctx.name ?? '').replace(/[^\p{L}\p{M}' -]/gu, '').trim().slice(0, 24);
  const goals = (ctx.goals ?? []).slice(0, 6).join(', ') || 'nenhum indicado';
  const usage =
    ctx.todayUsedMinutes != null && ctx.todayLimitMinutes != null
      ? `${ctx.todayUsedMinutes} de ${ctx.todayLimitMinutes} minutos permitidos nas apps controladas hoje`
      : 'sem dados de utilização de hoje';
  const lang = ctx.language === 'pt-BR' ? 'Português do Brasil (trata por você).' : 'Português europeu (trata por tu).';
  const country = String(ctx.country ?? '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  const num = (v?: string | null) => String(v ?? '').replace(/[^\d +]/g, '').slice(0, 18);
  const lines = [num(ctx.emergency) && `emergência ${num(ctx.emergency)}`, num(ctx.crisis) && `apoio emocional ${num(ctx.crisis)}${ctx.crisisName ? ` (${String(ctx.crisisName).slice(0, 60)})` : ''}`].filter(Boolean).join(', ');
  return `${name.length >= 2 ? `Nome: ${name}. ` : ''}${country ? `País: ${country}. ` : ''}Língua: ${lang} ${lines ? `Números de ajuda do país: ${lines}. ` : ''}Objectivos do utilizador: ${goals}. Utilização: ${usage}.`;
}
