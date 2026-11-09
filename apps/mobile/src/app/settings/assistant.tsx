import { useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppInput, AppSwitch, AppText, ListRow, Screen, SectionTitle, toast } from '@/components';
import { speak, voiceLine } from '@/services/coach';
import { usePrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** Assistente do offly: como te chama e se fala em voz alta nos momentos difíceis. */
export default function AssistantSettings() {
  const { prefs, update } = usePrefs();
  const [name, setName] = useState(prefs.displayName);
  const [testing, setTesting] = useState(false);

  return (
    <Screen testID="assistant-settings">
      <AppHeader title="Assistente" back />
      <AppText variant="small" tone="secondary">
        Um só assistente: conversa contigo, ajuda a decidir quando pedes mais tempo numa app e fala contigo quando o impulso aperta.
      </AppText>

      <SectionTitle>Como te chamo</SectionTitle>
      <AppInput label="O teu nome (opcional)" value={name} onChangeText={setName} autoCapitalize="words" maxLength={24} />
      <AppButton
        label="Guardar nome"
        size="sm"
        variant="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => void update({ displayName: name.trim() }).then(() => toast('Nome guardado.'))}
      />

      <SectionTitle>Voz</SectionTitle>
      <View style={{ gap: spacing.md }}>
        <ListRow
          icon={{ set: 'feather', name: 'volume-2' }}
          title="Falar comigo em voz alta"
          subtitle="Na pausa do launcher, no bloqueio, num pedido de tempo extra e quando pensas em desistir"
          right={<AppSwitch value={prefs.voiceCoach} onValueChange={(v) => void update({ voiceCoach: v })} accessibilityLabel="Falar comigo em voz alta" />}
        />
        <AppButton
          label="Ouvir um exemplo"
          size="sm"
          variant="ghost"
          loading={testing}
          onPress={async () => {
            setTesting(true);
            const ok = await speak(voiceLine('intention', { app: 'TikTok' }));
            setTesting(false);
            if (!ok) toast(prefs.voiceCoach ? 'A voz precisa de sessão iniciada e de ligação à internet.' : 'Ligue a voz primeiro.', 'error');
          }}
        />
      </View>

      <SectionTitle>Privacidade</SectionTitle>
      <AppCard>
        <AppText variant="caption" tone="muted">
          Para decidir um pedido de tempo extra, o offly envia apenas a app, o motivo escolhido, os minutos, a hora e quantos hábitos faltam
          hoje. A voz recebe só a frase que vai ser dita. Nenhuma chave de IA está no telemóvel.
        </AppText>
      </AppCard>
    </Screen>
  );
}
