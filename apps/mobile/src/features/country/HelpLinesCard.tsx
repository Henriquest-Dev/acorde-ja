import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppCard, AppText } from '@/components';
import { usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { findCountry, helpLinesFor, telHref } from './countries';

/** Linhas de ajuda do país da pessoa, com botão para ligar. */
export function HelpLinesCard({ compact }: { compact?: boolean }) {
  const { colors } = useTheme();
  const { country, helpLines } = usePrefs((s) => s.prefs);
  const lines = helpLinesFor(country, helpLines);
  const c = findCountry(country);
  const rows = [
    { label: 'Emergência', number: lines.emergency || lines.medical || lines.police, icon: 'alert-triangle' as const },
    { label: 'Emergência médica', number: lines.medical !== lines.emergency ? lines.medical : '', icon: 'plus-square' as const },
    { label: 'Polícia', number: lines.police !== lines.emergency ? lines.police : '', icon: 'shield' as const },
    { label: lines.crisisName ? `Apoio emocional · ${lines.crisisName}` : 'Apoio emocional', number: lines.crisis, icon: 'heart' as const },
    { label: 'Saúde (não urgente)', number: compact ? '' : lines.health, icon: 'phone' as const },
    { label: lines.addictionName ? `Dependências · ${lines.addictionName}` : 'Dependências', number: compact ? '' : lines.addiction, icon: 'life-buoy' as const },
  ].filter((r) => r.number);

  return (
    <AppCard testID="help-lines">
      <AppText variant="small" weight="semibold">
        Se estiveres em perigo{c ? ` · ${c.name}` : ''}
      </AppText>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {rows.map((r) => (
          <Pressable
            key={r.label}
            onPress={() => void Linking.openURL(telHref(r.number))}
            accessibilityRole="button"
            accessibilityLabel={`Ligar ${r.label}, ${r.number}`}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <Feather name={r.icon} size={16} color={colors.text} />
            <AppText variant="small" style={{ flex: 1 }}>
              {r.label}
            </AppText>
            <AppText variant="bodyStrong">{r.number}</AppText>
            <Feather name="phone-call" size={16} color={colors.text} />
          </Pressable>
        ))}
      </View>
      {!rows.length ? (
        <AppText variant="small" tone="secondary" style={{ marginTop: spacing.sm }}>
          Ainda não temos os números do teu país.
        </AppText>
      ) : null}
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }} onPress={() => router.push('/profile-setup')}>
        O offly não substitui ajuda profissional. Mudar país ou números
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
