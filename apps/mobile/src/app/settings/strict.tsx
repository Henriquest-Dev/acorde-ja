import { useState } from 'react';
import { View } from 'react-native';
import { AppCard, AppHeader, AppSlider, AppSwitch, AppText, Screen, SectionTitle } from '@/components';
import { MindfulPause } from '@/components/MindfulPause';
import { qk, useInvalidate } from '@/hooks/queries';
import { syncRulesToNative } from '@/services/usage';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** Modo restrito e regras de excepção (tempo extra consciente). */
export default function Strict() {
  const { prefs, update } = usePrefs();
  const invalidate = useInvalidate();
  const [confirm, setConfirm] = useState(false);
  const r = prefs.rules;

  const setRules = async (patch: Partial<typeof r>) => {
    await update((p) => ({ rules: { ...p.rules, ...patch }, shield: { ...p.shield, strictMode: patch.strictMode ?? p.shield.strictMode } }));
    await syncRulesToNative();
    await invalidate(qk.today);
  };

  return (
    <Screen>
      <AppHeader title="Modo restrito" back />
      <AppCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Modo restrito</AppText>
            <AppText variant="caption" tone="muted">
              Sem tempo extra, sem desligar protecções de sites nem horários. Desligar exige uma pausa de 30 segundos.
            </AppText>
          </View>
          <AppSwitch value={r.strictMode} onValueChange={(v) => (v ? void setRules({ strictMode: true }) : setConfirm(true))} accessibilityLabel="Modo restrito" />
        </View>
      </AppCard>

      <View style={{ opacity: r.strictMode ? 0.4 : 1 }} pointerEvents={r.strictMode ? 'none' : 'auto'}>
        <SectionTitle>Tempo extra</SectionTitle>
        <AppText variant="small" tone="secondary">
          Minutos por excepção: {r.exceptionMinutes}
        </AppText>
        <AppSlider value={r.exceptionMinutes} min={1} max={15} onChange={(v) => void setRules({ exceptionMinutes: v })} accessibilityLabel="Minutos por excepção" />
        <AppText variant="small" tone="secondary" style={{ marginTop: spacing.md }}>
          Máximo por aplicação e por dia: {r.maxExceptionsPerDay}
        </AppText>
        <AppSlider value={r.maxExceptionsPerDay} min={0} max={5} onChange={(v) => void setRules({ maxExceptionsPerDay: v })} accessibilityLabel="Máximo de excepções" />
        <AppText variant="small" tone="secondary" style={{ marginTop: spacing.md }}>
          Pausa consciente: {r.mindfulPauseSeconds} segundos
        </AppText>
        <AppSlider value={r.mindfulPauseSeconds} min={15} max={120} step={15} onChange={(v) => void setRules({ mindfulPauseSeconds: v })} accessibilityLabel="Duração da pausa consciente" />
      </View>

      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xl }}>
        O Acorde Já nunca impede o acesso a chamadas de emergência nem às definições do sistema. Pode sempre desinstalar o aplicativo.
      </AppText>

      <MindfulPause
        visible={confirm}
        title="Desligar o modo restrito?"
        message="Respire fundo. Se ainda quiser desligar daqui a 30 segundos, está tudo bem."
        confirmLabel="Desligar"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void setRules({ strictMode: false });
        }}
      />
    </Screen>
  );
}
