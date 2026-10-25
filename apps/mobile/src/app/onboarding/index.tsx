import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheet, AppButton, AppText, MountainIllustration } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const FEATURES: { icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string }[] = [
  { icon: 'clock', title: 'Limites diários', text: 'Defina quanto tempo quer passar em cada aplicação. Avisamos aos 80% e bloqueamos aos 100%.' },
  { icon: 'shield', title: 'Proteção de sites', text: 'Bloqueie voluntariamente pornografia, apostas e outros sites que quer evitar.' },
  { icon: 'target', title: 'Modo foco', text: 'Sessões de concentração com temporizador e actividades alternativas.' },
  { icon: 'check-square', title: 'Hábitos', text: 'Construa rotinas saudáveis sem pontos nem pressão.' },
  { icon: 'bar-chart-2', title: 'Progresso', text: 'Relatórios com os seus dados reais, sem números inventados.' },
  { icon: 'message-circle', title: 'Assistente', text: 'Apoio em momentos de impulso e planos de redução gradual.' },
];

/** ONB-01 — Boas-vindas. */
export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [about, setAbout] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="onb-welcome">
      <View style={styles.hero}>
        <MountainIllustration height={360} />
        <Pressable
          onPress={() => router.push('/onboarding/permissions')}
          accessibilityRole="button"
          accessibilityLabel="Pular configuração"
          hitSlop={12}
          style={[styles.skip, { top: insets.top + 8 }]}
        >
          <AppText variant="small" style={{ color: '#FFFFFF' }}>
            Pular
          </AppText>
        </Pressable>
      </View>
      <Animated.View entering={reduce ? undefined : FadeInDown.duration(500)} style={styles.content}>
        <AppText variant="display" align="center" style={{ fontSize: 40 }} accessibilityRole="header">
          Acorde Já
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={{ marginTop: 4 }}>
          Menos tela. Mais vida.
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={styles.message}>
          Recupere o controlo do seu tempo e construa uma vida com mais foco e propósito.
        </AppText>
      </Animated.View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AppButton label="Começar" trailingIcon="chevron-right" onPress={() => router.push('/onboarding/goals')} testID="onb-start" />
        <AppButton label="Conhecer a plataforma" variant="ghost" size="sm" onPress={() => setAbout(true)} style={{ marginTop: spacing.xs }} />
      </View>

      <AppBottomSheet visible={about} onClose={() => setAbout(false)} title="O que o Acorde Já faz">
        <View style={{ gap: spacing.lg }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: spacing.md }}>
              <Feather name={f.icon} size={20} color={colors.text} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{f.title}</AppText>
                <AppText variant="small" tone="muted">
                  {f.text}
                </AppText>
              </View>
            </View>
          ))}
          <AppText variant="caption" tone="muted">
            O Acorde Já é uma ferramenta de autocontrolo e não substitui acompanhamento médico ou psicológico.
          </AppText>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { height: 360, overflow: 'hidden' },
  skip: { position: 'absolute', right: 20, padding: 4 },
  content: { flex: 1, paddingHorizontal: 32, marginTop: -40 },
  message: { marginTop: spacing.xxl, lineHeight: 23 },
  footer: { paddingHorizontal: 20 },
});
