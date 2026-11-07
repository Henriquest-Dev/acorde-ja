/**
 * Planos e preços do offly (USD). Fonte única para o ecrã de planos.
 *
 * Os `productId` são os que o gateway externo envia no webhook
 * (ver docs/billing.md e supabase/functions/_shared/billing.ts).
 */

export type PlanId = 'free' | 'pro' | 'pro_ai' | 'family' | 'lifetime';
export type BillingPeriod = 'monthly' | 'yearly';

export interface PlanPrice {
  /** Preço em USD. */
  usd: number;
  productId: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  highlight?: string;
  prices: Partial<Record<BillingPeriod | 'once', PlanPrice>>;
  features: string[];
  /** Dias de teste grátis no plano anual. */
  trialDays?: number;
}

export const CURRENCY = 'USD';

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Grátis',
    tagline: 'Para começar a desligar',
    prices: {},
    features: ['Launcher minimalista', 'Até 3 apps com limite', 'Modo foco', 'Relatórios do dia'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Controlo total do seu tempo',
    highlight: 'Mais popular',
    trialDays: 7,
    prices: {
      monthly: { usd: 3.99, productId: 'offly_pro_monthly' },
      yearly: { usd: 24.99, productId: 'offly_pro_yearly' },
    },
    features: [
      'Apps ilimitadas com limite',
      'Pausa de intenção no launcher',
      'Proteção de sites (adultos, apostas)',
      'Desafio com proteção trancada',
      'Horários de bloqueio',
      'Relatórios completos e exportação',
    ],
  },
  {
    id: 'pro_ai',
    name: 'Pro + IA',
    tagline: 'Pro com um assistente pessoal',
    trialDays: 7,
    prices: {
      monthly: { usd: 6.99, productId: 'offly_pro_ai_monthly' },
      yearly: { usd: 44.99, productId: 'offly_pro_ai_yearly' },
    },
    features: ['Tudo do Pro', 'Assistente IA para momentos de impulso', 'Planos de redução personalizados', 'Resumos semanais inteligentes'],
  },
  {
    id: 'family',
    name: 'Família',
    tagline: 'Pro para até 5 pessoas',
    prices: { yearly: { usd: 49.99, productId: 'offly_family_yearly' } },
    features: ['Pro para 5 membros', 'Controlo parental transparente', 'Pedidos de tempo extra', 'Relatório familiar semanal'],
  },
  {
    id: 'lifetime',
    name: 'Vitalício',
    tagline: 'Pague uma vez, use para sempre',
    prices: { once: { usd: 59.99, productId: 'offly_pro_lifetime' } },
    features: ['Tudo do Pro, para sempre', 'Sem renovações', 'Não inclui IA'],
  },
];

/** Linhas da tabela comparativa: valor por plano (true, false ou texto). */
export const COMPARISON: { feature: string; values: Record<'free' | 'pro' | 'pro_ai' | 'family', boolean | string> }[] = [
  { feature: 'Launcher minimalista', values: { free: true, pro: true, pro_ai: true, family: true } },
  { feature: 'Apps com limite', values: { free: '3', pro: 'Todas', pro_ai: 'Todas', family: 'Todas' } },
  { feature: 'Modo foco', values: { free: true, pro: true, pro_ai: true, family: true } },
  { feature: 'Pausa de intenção', values: { free: false, pro: true, pro_ai: true, family: true } },
  { feature: 'Proteção de sites', values: { free: false, pro: true, pro_ai: true, family: true } },
  { feature: 'Desafio trancado', values: { free: false, pro: true, pro_ai: true, family: true } },
  { feature: 'Horários de bloqueio', values: { free: false, pro: true, pro_ai: true, family: true } },
  { feature: 'Relatórios completos', values: { free: false, pro: true, pro_ai: true, family: true } },
  { feature: 'Assistente IA', values: { free: false, pro: false, pro_ai: true, family: false } },
  { feature: 'Contas incluídas', values: { free: '1', pro: '1', pro_ai: '1', family: '5' } },
];

export function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

/** Poupança do anual face a 12 meses do mensal, em %. */
export function yearlySavings(plan: Plan): number | null {
  const m = plan.prices.monthly?.usd;
  const y = plan.prices.yearly?.usd;
  if (!m || !y) return null;
  return Math.round((1 - y / (m * 12)) * 100);
}
