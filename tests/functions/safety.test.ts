import { describe, expect, it } from 'vitest';
import { CRISIS_REPLY, SYSTEM_PROMPT, buildContextNote, crisisReply, detectCrisis, extractCards } from '../../supabase/functions/_shared/safety';

describe('assistente — segurança', () => {
  it('detecta sinais de crise em português', () => {
    expect(detectCrisis('às vezes quero morrer')).toBe(true);
    expect(detectCrisis('penso em suicídio')).toBe(true);
    expect(detectCrisis('apetece-me magoar-me')).toBe(true);
  });

  it('não marca impulsos comuns como crise', () => {
    expect(detectCrisis('Estou com vontade de abrir o TikTok de novo.')).toBe(false);
    expect(detectCrisis('quero apostar no jogo de hoje')).toBe(false);
  });

  it('extrai cartões e limpa o texto', () => {
    expect(extractCards('Vamos respirar juntos?\n[cartao:respiracao]')).toEqual({ text: 'Vamos respirar juntos?', cards: ['breathing'] });
    expect(extractCards('Olá').cards).toEqual([]);
  });

  it('contexto é agregado e nunca inventa números', () => {
    expect(buildContextNote({ goals: ['focus'], todayUsedMinutes: null, todayLimitMinutes: null })).toContain('sem dados de utilização');
    expect(buildContextNote({ goals: [], todayUsedMinutes: 30, todayLimitMinutes: 110 })).toContain('30 de 110 minutos');
  });

  it('prompt de sistema proíbe diagnóstico, vergonha, apostas e alterar bloqueios', () => {
    for (const s of ['diagnósticos', 'envergonhas', 'incentivas apostas', 'alterar limites', 'nunca inventes dados']) {
      expect(SYSTEM_PROMPT).toContain(s);
    }
  });
});

describe('país e língua', () => {
  it('resposta de crise usa os números do país', () => {
    const r = crisisReply({ language: 'pt-BR', emergency: '190', crisis: '188', crisisName: 'CVV' });
    expect(r).toContain('190');
    expect(r).toContain('188');
    expect(r).toContain('você');
    expect(r).not.toContain('112');
  });
  it('sem números, usa a resposta segura de base', () => {
    expect(crisisReply({})).toBe(CRISIS_REPLY);
  });
  it('contexto indica a variante da língua e os números', () => {
    const n = buildContextNote({ country: 'BR', language: 'pt-BR', emergency: '190', crisis: '188', crisisName: 'CVV' });
    expect(n).toContain('País: BR');
    expect(n).toContain('Português do Brasil');
    expect(n).toContain('apoio emocional 188 (CVV)');
  });
});
