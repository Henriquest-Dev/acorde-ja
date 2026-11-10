import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AppButton, AppText, LeafBackdrop, MOOD_COLOR, Offy, type OffyMood } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Slide = { mood: OffyMood; title: string; text: string };

/** O Offy apresenta o app, uma ideia de cada vez, com a emoção a condizer. */
const SLIDES: Slide[] = [
  { mood: 'joy', title: 'Olá! Eu sou o Offy.', text: 'Vou ajudar-te a usar o telemóvel com intenção. Sem culpa, sem sermões.' },
  { mood: 'thinking', title: 'Limites que tu decides', text: 'Escolhes quanto tempo queres em cada app. Aviso-te aos 80% e fecho a app aos 100%, até o YouTube e os Shorts.' },
  { mood: 'calm', title: 'Quando apetecer voltar', text: 'Respiramos juntos, com sons de chuva, ondas ou floresta. O impulso passa, prometo.' },
  { mood: 'listening', title: 'Fala comigo', text: 'Estou no separador IA. Fico feliz quando cumpres, ansioso contigo quando custa, e ajudo-te a acalmar.' },
  { mood: 'idle', title: 'Foco e hábitos', text: 'Sessões de foco, pequenos hábitos e o teu progresso real. Tudo funciona mesmo sem internet.' },
  { mood: 'joy', title: 'A família junta', text: 'Adiciona os telemóveis da família e acompanha o tempo, o foco e os bloqueios num só painel.' },
];

export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;
  const mood = SLIDES[index]!.mood;
  const next = () => {
    if (last) return router.push('/onboarding/goals');
    setIndex(index + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]} testID="onb-welcome">
      <View style={styles.glow} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="onbGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={MOOD_COLOR[mood]} stopOpacity={0.3} />
              <Stop offset="1" stopColor={MOOD_COLOR[mood]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#onbGlow)" />
        </Svg>
      </View>
      <LeafBackdrop opacity={0.035} />

      <View style={styles.top}>
        <AppText variant="h3" style={{ fontFamily: 'Inter_700Bold', letterSpacing: -0.5 }}>
          offly
        </AppText>
        <Pressable onPress={() => router.push('/onboarding/goals')} accessibilityRole="button" accessibilityLabel="Pular apresentação" hitSlop={12}>
          <AppText variant="small" tone="secondary">
            Pular
          </AppText>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <Offy size={190} mood={mood} testID="offy-onboarding" />
      </View>

      <View style={styles.textArea}>
        <Animated.View key={index} entering={reduce ? undefined : FadeInDown.duration(380)}>
          <AppText variant="h1" align="center" accessibilityRole="header">
            {SLIDES[index]!.title}
          </AppText>
          <AppText variant="body" tone="secondary" align="center" style={{ marginTop: spacing.md, lineHeight: 23 }}>
            {SLIDES[index]!.text}
          </AppText>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots} accessibilityLabel={`Passo ${index + 1} de ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <Pressable key={s.title} onPress={() => setIndex(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Ir para o passo ${i + 1}`}>
              <View style={[styles.dot, { backgroundColor: i === index ? colors.text : colors.border, width: i === index ? 22 : 7 }]} />
            </Pressable>
          ))}
        </View>
        <AppButton label={last ? 'Começar' : 'Seguinte'} trailingIcon="chevron-right" onPress={next} testID={last ? 'onb-start' : 'onb-next'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: { position: 'absolute', top: 20, left: -60, right: -60, height: 480 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: spacing.md },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textArea: { minHeight: 150, paddingHorizontal: 32, justifyContent: 'flex-start' },
  footer: { paddingHorizontal: 20, gap: spacing.lg, marginTop: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4 },
});
