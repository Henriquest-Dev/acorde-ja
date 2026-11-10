/**
 * Moldura dos ecrãs de entrada: o Offy grande a reagir ao que a pessoa faz,
 * um halo suave da cor da emoção, folhas ao fundo e o formulário num cartão.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AppText, LeafBackdrop, MOOD_COLOR, Offy, type OffyMood } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function AuthShell({
  mood,
  say,
  title,
  subtitle,
  children,
  footer,
}: {
  mood: OffyMood;
  say: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Halo da cor da emoção atrás do Offy */}
      <Animated.View key={mood} entering={FadeIn.duration(600)} exiting={FadeOut.duration(600)} style={styles.glow} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="authGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={MOOD_COLOR[mood]} stopOpacity={0.32} />
              <Stop offset="1" stopColor={MOOD_COLOR[mood]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#authGlow)" />
        </Svg>
      </Animated.View>
      <LeafBackdrop opacity={0.035} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.hero}>
          <Animated.View key={say} entering={reduce ? undefined : FadeInDown.duration(300)} style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText variant="small" align="center">
              {say}
            </AppText>
            <View style={[styles.tail, { backgroundColor: colors.card, borderColor: colors.border }]} />
          </Animated.View>
          <Offy size={150} mood={mood} testID="offy-auth" />
        </View>
        <AppText variant="display" align="center" style={{ fontSize: 34, lineHeight: 40 }} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" tone="secondary" align="center" style={{ marginTop: spacing.xs, paddingHorizontal: spacing.lg }}>
            {subtitle}
          </AppText>
        ) : null}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
        {footer ? <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: -60, left: -40, right: -40, height: 460 },
  scroll: { paddingHorizontal: 20, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.md },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, maxWidth: 280, marginBottom: 6 },
  tail: { position: 'absolute', bottom: -6, alignSelf: 'center', width: 12, height: 12, transform: [{ rotate: '45deg' }], borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, gap: spacing.lg },
});
