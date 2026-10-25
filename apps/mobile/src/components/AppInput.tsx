import { useState } from 'react';
import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii } from '@/theme/tokens';
import { AppText } from './AppText';

export interface AppInputProps extends ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
  hint?: string;
}

export function AppInput({ ref, label, error, hint, style, editable = true, ...rest }: AppInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="small" tone="secondary">
          {label}
        </AppText>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={colors.textMuted}
        editable={editable}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: error ? colors.text : focused ? colors.textSecondary : colors.border,
            opacity: editable ? 1 : 0.5,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.text }}>
          ⚠ {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15 },
});
