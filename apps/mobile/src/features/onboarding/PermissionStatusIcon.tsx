import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { PermissionState } from '@/native/device';
import { useTheme } from '@/theme/ThemeProvider';

/** Círculo de estado: preenchido com visto = concedida; vazio = pendente; traço = indisponível. */
export function PermissionStatusIcon({ state }: { state: PermissionState }) {
  const { colors } = useTheme();
  if (state === 'granted') {
    return (
      <View style={[styles.status, { backgroundColor: colors.accent, borderColor: colors.accent }]} accessibilityLabel="Concedida">
        <Feather name="check" size={13} color={colors.onAccent} />
      </View>
    );
  }
  if (state === 'unsupported') {
    return (
      <View style={[styles.status, { borderColor: colors.border }]} accessibilityLabel="Indisponível">
        <Feather name="minus" size={12} color={colors.textMuted} />
      </View>
    );
  }
  return <View style={[styles.status, { borderColor: colors.textMuted }]} accessibilityLabel="Pendente" />;
}

const styles = StyleSheet.create({
  status: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
