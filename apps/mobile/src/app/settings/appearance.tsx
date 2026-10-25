import { AppHeader, AppRadioGroup, AppText, Screen, SectionTitle } from '@/components';
import { usePrefs } from '@/stores/prefs';
import type { ThemePreference } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function Appearance() {
  const { prefs, update } = usePrefs();
  return (
    <Screen>
      <AppHeader title="Interface e idioma" back />
      <SectionTitle>Tema</SectionTitle>
      <AppRadioGroup<ThemePreference>
        options={[
          { value: 'dark', label: 'Escuro', description: 'Preto absoluto, ideal à noite' },
          { value: 'light', label: 'Claro' },
          { value: 'system', label: 'Automático', description: 'Segue o sistema' },
        ]}
        value={prefs.theme}
        onChange={(theme) => void update({ theme })}
      />
      <SectionTitle>Idioma</SectionTitle>
      <AppRadioGroup options={[{ value: 'pt-PT', label: 'Português (Portugal)' }]} value="pt-PT" onChange={() => undefined} />
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        Mais idiomas serão disponibilizados com a expansão internacional. As animações respeitam a opção «Reduzir movimento» do sistema.
      </AppText>
    </Screen>
  );
}
