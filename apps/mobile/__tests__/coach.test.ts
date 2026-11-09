/// <reference types="jest" />
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/cache' } }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => null }));
import { decideExtraTime, offlineDecision, speak, voiceLine } from '@/services/coach';
import { usePrefs } from '@/stores/prefs';

const input = { app: 'TikTok', reason: 'other' as const, limitMinutes: 30, usedMinutes: 34, requestsToday: 0, challengeActive: false, habitsDue: 1, habitsDone: 0 };

describe('assistente: decisão sem servidor', () => {
  it('desafio activo ou muitos pedidos: recusa', () => {
    expect(offlineDecision({ ...input, challengeActive: true }, 'Pedro').decision).toBe('deny');
    expect(offlineDecision({ ...input, requestsToday: 3 }, null).decision).toBe('deny');
  });
  it('emergência: permite; caso normal: respirar primeiro', () => {
    expect(offlineDecision({ ...input, reason: 'emergency' }, null).decision).toBe('allow');
    expect(offlineDecision(input, null)).toMatchObject({ decision: 'wait', requirement: 'breathe' });
  });
  it('sem servidor usa as regras locais', async () => {
    await expect(decideExtraTime(input)).resolves.toMatchObject({ source: 'offline' });
  });
});

describe('assistente: voz', () => {
  it('frases com o nome da pessoa', () => {
    usePrefs.setState((s) => ({ prefs: { ...s.prefs, displayName: 'Yara Santos' } }));
    expect(voiceLine('relapse')).toContain('Yara');
    expect(voiceLine('intention', { app: 'YouTube' })).toContain('YouTube');
  });
  it('com a voz desligada não fala', async () => {
    usePrefs.setState((s) => ({ prefs: { ...s.prefs, voiceCoach: false } }));
    await expect(speak('olá')).resolves.toBe(false);
  });
});
