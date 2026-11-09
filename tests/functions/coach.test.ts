import { describe, expect, it } from 'vitest';
import { buildDecisionRequest, chatBody, cleanName, decide, speechBody, type DecisionContext } from '../../supabase/functions/_shared/coach';

const base: DecisionContext = {
  app: 'TikTok', reason: 'other', limitMinutes: 30, usedMinutes: 34, requestsToday: 0, hour: 23,
  challengeActive: false, habitsDue: 2, habitsDone: 0, name: 'Pedro',
};
const model = (decision: string, requirement = 'breathe') => ({ answers: { decision: { choice: decision, confidence: 0.6 }, requirement: { choice: requirement } } });

describe('coach: decisão de tempo extra', () => {
  it('pedido para o Parallel Decisions com perguntas e estado', () => {
    const r = buildDecisionRequest(base);
    expect(r.model).toBe('parallel/decisions-fast:free');
    expect(Object.keys(r.questions)).toEqual(['decision', 'requirement']);
    expect(r.state.habitos_por_fazer_hoje).toBe(2);
  });

  it('segue o modelo quando não há regra fixa', () => {
    const d = decide(base, model('deny'));
    expect(d).toMatchObject({ decision: 'deny', requirement: 'none', source: 'model' });
    expect(d.message).toContain('Pedro');
    expect(decide(base, model('allow', 'habit'))).toMatchObject({ decision: 'allow', requirement: 'habit' });
  });

  it('regras fixas vencem o modelo', () => {
    expect(decide({ ...base, challengeActive: true }, model('allow'))).toMatchObject({ decision: 'deny', source: 'rule' });
    expect(decide({ ...base, requestsToday: 3 }, model('allow'))).toMatchObject({ decision: 'deny', source: 'rule' });
    expect(decide({ ...base, reason: 'emergency' }, model('deny'))).toMatchObject({ decision: 'allow', requirement: 'none', source: 'rule' });
  });

  it('sem resposta do modelo pede uma pausa (nunca bloqueia nem liberta às cegas)', () => {
    expect(decide(base, null)).toMatchObject({ decision: 'wait', requirement: 'breathe', source: 'fallback' });
  });

  it('não pede hábito quando já estão todos feitos', () => {
    expect(decide({ ...base, habitsDone: 2 }, model('allow', 'habit')).requirement).toBe('breathe');
  });

  it('nome limpo e corpos de conversa e voz', () => {
    expect(cleanName('  Ana<script> ')).toBe('Anascript');
    expect(cleanName('x')).toBeNull();
    expect(chatBody('s', [{ role: 'user', content: 'oi' }]).messages[0]).toEqual({ role: 'system', content: 's' });
    expect(speechBody('a'.repeat(1000)).input.length).toBe(320);
  });
});
