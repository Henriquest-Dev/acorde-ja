/** Mensagens curtas de incentivo — uma por dia, sem notificações nem pressão. */
export const QUOTES = [
  'Hoje é uma nova oportunidade para ser a melhor versão de si.',
  'O seu tempo é a coisa mais valiosa que tem.',
  'Menos deslizar, mais viver.',
  'Pequenas escolhas, grandes mudanças.',
  'Olhe para cima: a vida está a acontecer à sua volta.',
  'A atenção é um presente. Ofereça-a ao que importa.',
  'Um passo de cada vez também é progresso.',
  'Desligar é também uma forma de cuidar de si.',
];

export function quoteOfTheDay(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length]!;
}
