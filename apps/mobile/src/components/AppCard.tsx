import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

export interface AppCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function AppCard({ children, onPress, style, padded = true, elevated, accessibilityLabel, testID }: AppCardProps) {
  const { colors } = useTheme();
  const base = [
    styles.card,
    { backgroundColor: elevated ? colors.elevated : colors.card, borderColor: colors.border },
    padded && styles.padded,
    style,
  ];
  if (!onPress) {
    return (
      <View style={base} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...base, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: spacing.lg },
});
