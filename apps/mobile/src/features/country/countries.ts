/**
 * Linhas de ajuda por país. Só pré-preenchemos números confirmados; quando as fontes
 * não coincidem, o campo fica vazio e a pessoa confirma o número do seu país na configuração.
 */
export type LanguageVariant = 'pt-PT' | 'pt-BR';

export interface HelpLines {
  /** Número geral de emergência. */
  emergency: string;
  /** Polícia / segurança. */
  police: string;
  /** Emergência médica / ambulância. */
  medical: string;
  /** Saúde não urgente (aconselhamento por telefone). */
  health: string;
  /** Apoio emocional / prevenção do suicídio. */
  crisis: string;
  crisisName: string;
  /** Apoio a dependências (jogo, álcool, etc.). */
  addiction: string;
  addictionName: string;
}

export interface Country {
  code: string;
  name: string;
  language: LanguageVariant;
  lines: HelpLines;
}

const L = (p: Partial<HelpLines>): HelpLines => ({
  emergency: '',
  police: '',
  medical: '',
  health: '',
  crisis: '',
  crisisName: '',
  addiction: '',
  addictionName: '',
  ...p,
});

export const COUNTRIES: Country[] = [
  {
    code: 'PT',
    name: 'Portugal',
    language: 'pt-PT',
    lines: L({ emergency: '112', police: '112', medical: '112', health: '808 24 24 24', crisis: '213 544 545', crisisName: 'SOS Voz Amiga', addiction: '1414', addictionName: 'Linha Vida' }),
  },
  {
    code: 'BR',
    name: 'Brasil',
    language: 'pt-BR',
    lines: L({ emergency: '190', police: '190', medical: '192', crisis: '188', crisisName: 'CVV — Centro de Valorização da Vida' }),
  },
  { code: 'AO', name: 'Angola', language: 'pt-PT', lines: L({ police: '113' }) },
  { code: 'MZ', name: 'Moçambique', language: 'pt-PT', lines: L({}) },
  { code: 'CV', name: 'Cabo Verde', language: 'pt-PT', lines: L({ police: '132' }) },
  { code: 'GW', name: 'Guiné-Bissau', language: 'pt-PT', lines: L({}) },
  { code: 'ST', name: 'São Tomé e Príncipe', language: 'pt-PT', lines: L({}) },
  { code: 'TL', name: 'Timor-Leste', language: 'pt-PT', lines: L({}) },
  {
    code: 'US',
    name: 'Estados Unidos',
    language: 'pt-BR',
    lines: L({ emergency: '911', police: '911', medical: '911', crisis: '988', crisisName: '988 Suicide & Crisis Lifeline' }),
  },
  {
    code: 'CA',
    name: 'Canadá',
    language: 'pt-PT',
    lines: L({ emergency: '911', police: '911', medical: '911', crisis: '988', crisisName: '988 Suicide Crisis Helpline' }),
  },
  {
    code: 'GB',
    name: 'Reino Unido',
    language: 'pt-PT',
    lines: L({ emergency: '999', police: '999', medical: '999', health: '111', crisis: '116 123', crisisName: 'Samaritans' }),
  },
  { code: 'IE', name: 'Irlanda', language: 'pt-PT', lines: L({ emergency: '112', police: '112', medical: '112', crisis: '116 123', crisisName: 'Samaritans' }) },
  { code: 'ES', name: 'Espanha', language: 'pt-PT', lines: L({ emergency: '112', police: '112', medical: '112', crisis: '024', crisisName: 'Línea 024' }) },
  {
    code: 'FR',
    name: 'França',
    language: 'pt-PT',
    lines: L({ emergency: '112', police: '17', medical: '15', crisis: '3114', crisisName: '3114 — prevenção do suicídio' }),
  },
  {
    code: 'DE',
    name: 'Alemanha',
    language: 'pt-PT',
    lines: L({ emergency: '112', police: '110', medical: '112', crisis: '0800 111 0 111', crisisName: 'TelefonSeelsorge' }),
  },
  {
    code: 'CH',
    name: 'Suíça',
    language: 'pt-PT',
    lines: L({ emergency: '112', police: '117', medical: '144', crisis: '143', crisisName: 'Die Dargebotene Hand / La Main Tendue' }),
  },
  {
    code: 'LU',
    name: 'Luxemburgo',
    language: 'pt-PT',
    lines: L({ emergency: '112', police: '113', medical: '112', crisis: '454545', crisisName: 'SOS Détresse' }),
  },
  { code: 'BE', name: 'Bélgica', language: 'pt-PT', lines: L({ emergency: '112', police: '101', medical: '112' }) },
  { code: 'NL', name: 'Países Baixos', language: 'pt-PT', lines: L({ emergency: '112', police: '112', medical: '112', crisis: '113', crisisName: '113 Zelfmoordpreventie' }) },
  { code: 'IT', name: 'Itália', language: 'pt-PT', lines: L({ emergency: '112', police: '112', medical: '112' }) },
];

export const OTHER_COUNTRY: Country = { code: 'XX', name: 'Outro país', language: 'pt-PT', lines: L({ emergency: '112' }) };

export const findCountry = (code: string | null | undefined): Country | null =>
  code ? (COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? (code === 'XX' ? OTHER_COUNTRY : null)) : null;

/** Combina os números do país com os que a pessoa confirmou ou escreveu. */
export function helpLinesFor(code: string | null | undefined, custom?: Partial<HelpLines> | null): HelpLines {
  const base = findCountry(code)?.lines ?? OTHER_COUNTRY.lines;
  const out = { ...base };
  for (const [k, v] of Object.entries(custom ?? {})) if (typeof v === 'string' && v.trim()) (out as Record<string, string>)[k] = v.trim();
  return out;
}

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
