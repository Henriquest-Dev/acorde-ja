import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';
import { AppText } from './AppText';

export interface AppButtonProps {
  label: string;
  onPress?: () => void;
  /** primary: fundo branco; secondary: contorno; ghost: só texto; subtle: cartão escuro. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle';
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  trailingIcon?: ComponentProps<typeof Feather>['name'];
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  trailingIcon,
  leading,
  style,
  accessibilityHint,
  testID,
}: AppButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const bg =
    variant === 'primary' ? colors.accent : variant === 'subtle' ? colors.card : 'transparent';
  const fg = variant === 'primary' ? colors.onAccent : colors.text;
  const border = variant === 'secondary' ? colors.text : variant === 'subtle' ? colors.border : 'transparent';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: bg, borderColor: border, opacity: inactive ? 0.45 : pressed ? 0.78 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          <AppText variant={size === 'sm' ? 'small' : 'bodyStrong'} style={{ color: fg }}>
            {label}
          </AppText>
          {trailingIcon ? <Feather name={trailingIcon} size={18} color={fg} style={styles.trailing} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 52, paddingHorizontal: 20 },
  sm: { minHeight: 40, paddingHorizontal: 14, borderRadius: radii.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  trailing: { position: 'absolute', right: 0 },
});
