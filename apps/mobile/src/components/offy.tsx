/**
 * Offy, o mascote: um galo redondo de feltro com a crista em meio-sol (os raios do logótipo).
 * Estados: `idle` (pisca os olhos de vez em quando), `thinking` (olha para cima, com três pontos),
 * `calm` (olhos fechados, para os ecrãs de calma) e `listening` (olhos abertos, sem piscar).
 * Movimento lento e raro; com «Reduzir movimento» fica parado.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type OffyMood = 'idle' | 'thinking' | 'calm' | 'listening';

const FELT = '#EFEDE8';
const FELT_SHADE = '#D9D6CF';
const INK = '#141414';

export function Offy({ size = 96, mood = 'idle', testID }: { size?: number; mood?: OffyMood; testID?: string }) {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const comb = isDark ? '#A39E94' : INK;
  const reduce = useReducedMotion();
  const lid = useSharedValue(mood === 'calm' ? 0.1 : 1); // 1 = aberto, 0.1 = fechado
  const look = useSharedValue(0); // 0 = em frente, 1 = para cima
  const sway = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(lid);
    cancelAnimation(look);
    cancelAnimation(sway);
    if (mood === 'calm') {
      lid.set(withTiming(0.1, { duration: 600 }));
      look.set(withTiming(0, { duration: 400 }));
      // Balanço muito lento, como quem respira a dormir.
      sway.set(reduce ? 0 : withRepeat(withSequence(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })), -1));
      return;
    }
    sway.set(withTiming(0, { duration: 400 }));
    look.set(withTiming(mood === 'thinking' ? 1 : 0, { duration: 350, easing: Easing.out(Easing.quad) }));
    if (reduce || mood === 'listening') {
      lid.set(withTiming(1, { duration: 200 }));
      return;
    }
    const blink = withSequence(withTiming(0.1, { duration: 70 }), withTiming(1, { duration: 110 }));
    lid.set(
      withRepeat(
        withSequence(
          withDelay(mood === 'thinking' ? 1800 : 3400, blink),
          withDelay(mood === 'thinking' ? 2600 : 4800, blink),
          withDelay(250, blink), // de vez em quando, um piscar duplo
        ),
        -1,
      ),
    );
  }, [mood, reduce, lid, look, sway]);

  const eye = size * 0.15;
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.value }] }));
  const pupilStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -look.value * eye * 0.18 }, { translateX: look.value * eye * 0.08 }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${(sway.value - 0.5) * 3}deg` }, { translateY: sway.value * size * 0.012 }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Offy, o mascote do offly" testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Crista em meio-sol com 5 raios */}
          <G>
            {[-150, -120, -90, -60, -30].map((deg) => {
              const a = (deg * Math.PI) / 180;
              const x = 50 + Math.cos(a) * 17;
              const y = 31 + Math.sin(a) * 17;
              return <Ellipse key={deg} cx={x} cy={y} rx={4.2} ry={7.6} fill={comb} transform={`rotate(${deg + 90} ${x} ${y})`} />;
            })}
            <Path d="M36 32 A14 14 0 0 1 64 32 Z" fill={comb} />
          </G>
          {/* Corpo em ovo */}
          <Path d="M50 24 C73 24 84 46 84 64 C84 82 69 94 50 94 C31 94 16 82 16 64 C16 46 27 24 50 24 Z" fill={FELT} stroke={isDark ? 'none' : INK} strokeWidth={1.4} />
          {/* Sombra suave em baixo e asa */}
          <Path d="M20 72 C26 88 40 93 50 93 C62 93 76 88 81 72 C70 84 30 84 20 72 Z" fill={FELT_SHADE} />
          <Path d="M70 62 C79 64 80 76 72 80 C67 76 66 68 70 62 Z" fill={FELT_SHADE} />
          {/* Bico */}
          <Path d="M46 60 L54 60 L50 66 Z" fill={INK} />
          {/* Pontos de costura do feltro */}
          {[30, 38, 62, 70].map((x) => (
            <Circle key={x} cx={x} cy={86 - Math.abs(50 - x) * 0.25} r={0.7} fill={FELT_SHADE} />
          ))}
        </Svg>
        {/* Olhos: vistas animadas por cima do SVG */}
        {[0.36, 0.64].map((cx) => (
          <Animated.View
            key={cx}
            style={[
              styles.eye,
              { width: eye, height: eye, borderRadius: eye / 2, left: size * cx - eye / 2, top: size * 0.47 - eye / 2 },
              eyeStyle,
            ]}
          >
            <Animated.View style={[styles.shine, { width: eye * 0.32, height: eye * 0.32, borderRadius: eye, left: eye * 0.2, top: eye * 0.16 }, pupilStyle]} />
          </Animated.View>
        ))}
      </Animated.View>
      {mood === 'thinking' ? <ThinkingDots size={size} /> : null}
    </View>
  );
}

function ThinkingDots({ size }: { size: number }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.set(withRepeat(withTiming(3, { duration: 1500, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const dot = size * 0.06;
  return (
    <View style={[styles.dots, { top: size * 0.04, right: -size * 0.02, gap: dot * 0.6 }]} accessibilityLabel="A pensar">
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} t={t} dot={dot} color={colors.text} still={reduce} />
      ))}
    </View>
  );
}

function Dot({ i, t, dot, color, still }: { i: number; t: { value: number }; dot: number; color: string; still: boolean }) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.6 };
    const phase = (t.value - i + 3) % 3; // 0..3
    const on = phase < 1 ? phase : phase < 2 ? 2 - phase : 0;
    return { opacity: 0.25 + on * 0.65, transform: [{ translateY: -on * dot * 0.5 }] };
  });
  return <Animated.View style={[{ width: dot, height: dot, borderRadius: dot, backgroundColor: color }, style]} />;
}

/** Folhas monocromáticas, muito ténues, por trás do conteúdo. Decorativo e estático. */
export function LeafBackdrop({ opacity = 0.07 }: { opacity?: number }) {
  const { colors } = useTheme();
  const leaves: [number, number, number, number][] = [
    // x, y, escala, rotação
    [-6, 6, 1.5, 28],
    [78, -2, 1.1, -32],
    [88, 30, 0.8, 150],
    [-4, 46, 1.0, -20],
    [70, 60, 1.6, 205],
    [14, 82, 1.2, 40],
    [52, 92, 0.9, -60],
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {leaves.map(([x, y, s, r], i) => (
          <G key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} opacity={opacity}>
            <Path d="M0 0 C6 -10 18 -12 26 -6 C20 2 8 6 0 0 Z" fill={colors.text} />
            <Path d="M0 0 C8 -4 16 -6 26 -6" stroke={colors.background} strokeWidth={0.6} fill="none" />
            {[6, 12, 18].map((k) => (
              <Path key={k} d={`M${k} ${-k * 0.22} L${k + 3} ${-k * 0.22 - 3.2}`} stroke={colors.background} strokeWidth={0.4} />
            ))}
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  eye: { position: 'absolute', backgroundColor: INK, overflow: 'hidden' },
  shine: { position: 'absolute', backgroundColor: '#FFFFFF' },
  dots: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
});
