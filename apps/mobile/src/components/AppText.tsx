import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, type TypographyVariant } from '@/theme/tokens';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

const weights = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export function AppText({ variant = 'body', tone = 'primary', align, weight, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'primary' ? colors.text : tone === 'secondary' ? colors.textSecondary : tone === 'muted' ? colors.textMuted : colors.onAccent;
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, weight ? { fontFamily: weights[weight] } : null, style]}
    />
  );
}
