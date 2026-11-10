/**
 * Offy, o mascote: uma bola suave com a crista de galo em forma de sol nascente.
 * Tem emoções que acompanham o estado da pessoa (cor, cara e movimento próprios).
 * Cada emoção é um ciclo de keyframes (Reanimated) — lento e discreto; com
 * «Reduzir movimento» fica parado na pose base.
 */
import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type OffyMood = 'idle' | 'listening' | 'thinking' | 'joy' | 'calm' | 'anxious' | 'fear' | 'sad' | 'angry';

/** Cor de cada emoção (tons suaves). */
export const MOOD_COLOR: Record<OffyMood, string> = {
  idle: '#8E9BF0',
  listening: '#8E9BF0',
  thinking: '#4FB6DC',
  joy: '#F5C24C',
  calm: '#5BC48D',
  anxious: '#F29A56',
  fear: '#C3A5EA',
  sad: '#6DBEF3',
  angry: '#E2625F',
};

export const MOOD_LABEL: Record<OffyMood, string> = {
  idle: 'tranquilo',
  listening: 'a ouvir',
  thinking: 'a pensar',
  joy: 'feliz',
  calm: 'em paz',
  anxious: 'ansioso',
  fear: 'com medo',
  sad: 'triste',
  angry: 'zangado',
};

const INK = '#191919';

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1!, r2!)}${m(g1!, g2!)}${m(b1!, b2!)}`;
};

/* ------------------------------------------------------------------ */
/* Keyframes de movimento: cada fotograma diz para onde ir e em quanto tempo.
   Os valores omitidos mantêm-se do fotograma anterior.                    */
type Frame = { tx?: number; ty?: number; rot?: number; sc?: number; d: number };
const LOOPS: Record<OffyMood, Frame[]> = {
  idle: [{ ty: 0, d: 0 }, { ty: -3, d: 1700 }, { ty: 0, d: 1700 }],
  listening: [{ rot: 4, ty: -1, d: 500 }, { rot: 5, d: 2200 }, { rot: 4, d: 2200 }],
  thinking: [{ rot: -6, ty: -1, d: 600 }, { rot: -8, ty: -3, d: 1500 }, { rot: -6, ty: -1, d: 1500 }],
  joy: [{ ty: 0, sc: 1, d: 0 }, { ty: -10, sc: 1.04, d: 260 }, { ty: 0, sc: 0.95, d: 220 }, { sc: 1.02, d: 160 }, { sc: 1, d: 140 }, { d: 900 }],
  calm: [{ sc: 1, ty: 0, d: 0 }, { sc: 1.045, ty: -2, d: 4000 }, { sc: 1, ty: 0, d: 6000 }],
  anxious: [{ tx: 0, d: 0 }, { tx: -1.4, d: 70 }, { tx: 1.4, d: 70 }, { tx: -1, d: 70 }, { tx: 1, d: 70 }, { tx: 0, d: 60 }, { d: 1100 }],
  fear: [{ sc: 0.94, ty: 3, tx: -0.8, d: 70 }, { tx: 0.8, d: 70 }],
  sad: [{ ty: 4, rot: 0, d: 0 }, { ty: 7, rot: -2, d: 2600 }, { ty: 4, rot: 0, d: 2600 }],
  angry: [{ tx: 0, sc: 1, d: 0 }, { tx: -2.4, sc: 1.03, d: 55 }, { tx: 2.4, d: 55 }, { tx: -1.6, d: 55 }, { tx: 1.6, d: 55 }, { tx: 0, sc: 1, d: 80 }, { d: 1500 }],
};

const KEYS = ['tx', 'ty', 'rot', 'sc'] as const;
const BASE = { tx: 0, ty: 0, rot: 0, sc: 1 };

function runLoop(frames: Frame[], values: Record<(typeof KEYS)[number], SharedValue<number>>, still: boolean) {
  for (const k of KEYS) {
    cancelAnimation(values[k]);
    let last = BASE[k];
    const steps = frames.map((f) => {
      last = f[k] ?? last;
      return withTiming(last, { duration: f.d, easing: Easing.inOut(Easing.sin) });
    });
    const first = frames[0]?.[k] ?? BASE[k];
    if (still) {
      values[k].set(withTiming(first, { duration: 300 }));
    } else if (steps.length > 1) {
      values[k].set(withRepeat(withSequence(...(steps as [number, ...number[]])), -1));
    } else {
      values[k].set(withTiming(last, { duration: 300 }));
    }
  }
}

/** Entrada de uma emoção nova: pequeno «squash & stretch». */
const MoodPop = new Keyframe({
  0: { transform: [{ scaleX: 0.86 }, { scaleY: 1.08 }], opacity: 0 },
  45: { transform: [{ scaleX: 1.06 }, { scaleY: 0.94 }], opacity: 1 },
  75: { transform: [{ scaleX: 0.98 }, { scaleY: 1.02 }] },
  100: { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
}).duration(520);

const OPEN_EYES: OffyMood[] = ['idle', 'listening', 'thinking', 'anxious', 'fear', 'sad', 'angry'];

export function Offy({ size = 96, mood = 'idle', testID }: { size?: number; mood?: OffyMood; testID?: string }) {
  const reduce = useReducedMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const sc = useSharedValue(1);
  const lid = useSharedValue(1);

  useEffect(() => {
    runLoop(LOOPS[mood], { tx, ty, rot, sc }, reduce);
    cancelAnimation(lid);
    lid.set(1);
    if (!reduce && OPEN_EYES.includes(mood)) {
      const blink = withSequence(withTiming(0.08, { duration: 70 }), withTiming(1, { duration: 120 }));
      const wait = mood === 'anxious' || mood === 'fear' ? 1300 : 3300;
      lid.set(withRepeat(withSequence(withDelay(wait, blink), withDelay(wait * 1.4, blink), withDelay(220, blink)), -1));
    }
  }, [mood, reduce, tx, ty, rot, sc, lid]);

  const s = size / 100;
  const body = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value * s }, { translateY: ty.value * s }, { rotate: `${rot.value}deg` }, { scale: sc.value }],
  }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.value }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`Offy, ${MOOD_LABEL[mood]}`} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        <Animated.View key={`orb-${mood}`} entering={reduce ? undefined : FadeIn.duration(450)} exiting={reduce ? undefined : FadeOut.duration(450)} style={StyleSheet.absoluteFill}>
          <Orb size={size} color={MOOD_COLOR[mood]} />
        </Animated.View>
        <Animated.View key={`face-${mood}`} entering={reduce ? undefined : MoodPop} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 53%' }, eyes]}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
              <Eyes mood={mood} />
            </Svg>
          </Animated.View>
          <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
            <Mouth mood={mood} />
          </Svg>
        </Animated.View>
      </Animated.View>
      {mood === 'thinking' ? <ThinkingDots size={size} /> : null}
    </View>
  );
}

/** Corpo: halo difuso, crista de sol e a bola com luz suave. */
function Orb({ size, color }: { size: number; color: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const light = mix(color, '#FFFFFF', 0.55);
  const deep = mix(color, '#000000', 0.12);
  const comb = mix(color, '#000000', 0.22);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`h${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.55" stopColor={color} stopOpacity={0.5} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`o${id}`} cx="42%" cy="34%" r="72%">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.5" stopColor={color} />
          <Stop offset="0.86" stopColor={deep} />
          <Stop offset="1" stopColor={deep} stopOpacity={0.35} />
        </RadialGradient>
        <RadialGradient id={`c${id}`} cx="50%" cy="80%" r="70%">
          <Stop offset="0" stopColor={mix(comb, '#FFFFFF', 0.25)} />
          <Stop offset="1" stopColor={comb} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={56} r={43} fill={`url(#h${id})`} />
      {/* Crista: meio-sol com 5 raios, a nascer por trás da cabeça */}
      <G fill={`url(#c${id})`}>
        {[-150, -120, -90, -60, -30].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const x = 50 + Math.cos(a) * 14;
          const y = 31 + Math.sin(a) * 14;
          return <Ellipse key={deg} cx={x} cy={y} rx={3.8} ry={6.6} transform={`rotate(${deg + 90} ${x} ${y})`} />;
        })}
        <Path d="M38 33 A12 12 0 0 1 62 33 Z" />
      </G>
      <Circle cx={50} cy={58} r={33} fill={`url(#o${id})`} />
      {/* Brilho */}
      <Ellipse cx={40} cy={42} rx={9} ry={5} fill="#FFFFFF" opacity={0.28} transform="rotate(-25 40 42)" />
    </Svg>
  );
}

const glint = (cx: number, cy: number) => <Circle cx={cx} cy={cy} r={1.15} fill="#FFFFFF" />;
const stroke = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

function Eyes({ mood }: { mood: OffyMood }) {
  switch (mood) {
    case 'joy':
      return (
        <G {...stroke} strokeWidth={3.2}>
          <Path d="M35.5 55 Q40 48.5 44.5 55" />
          <Path d="M55.5 55 Q60 48.5 64.5 55" />
        </G>
      );
    case 'calm':
      return (
        <G {...stroke} strokeWidth={2.8}>
          <Path d="M35.5 52.5 Q40 57 44.5 52.5" />
          <Path d="M55.5 52.5 Q60 57 64.5 52.5" />
        </G>
      );
    case 'thinking':
      return (
        <G>
          <Ellipse cx={41} cy={51.5} rx={3.4} ry={4.4} fill={INK} />
          <Ellipse cx={61} cy={51.5} rx={3.4} ry={4.4} fill={INK} />
          {glint(42.3, 49.3)}
          {glint(62.3, 49.3)}
        </G>
      );
    case 'anxious':
      return (
        <G>
          <Circle cx={40} cy={53} r={3.8} fill={INK} />
          <Circle cx={60} cy={53} r={3.8} fill={INK} />
          {glint(41.3, 51.6)}
          {glint(61.3, 51.6)}
          <G {...stroke} strokeWidth={2.2}>
            <Path d="M35 47.5 L44 45" />
            <Path d="M65 47.5 L56 45" />
          </G>
        </G>
      );
    case 'fear':
      return (
        <G>
          <Ellipse cx={40.5} cy={53.5} rx={2.7} ry={3.5} fill={INK} />
          <Ellipse cx={59.5} cy={53.5} rx={2.7} ry={3.5} fill={INK} />
          <G {...stroke} strokeWidth={2.2}>
            <Path d="M35 48 Q39 44.5 44 46.5" />
            <Path d="M65 48 Q61 44.5 56 46.5" />
          </G>
        </G>
      );
    case 'sad':
      return (
        <G>
          <Ellipse cx={40} cy={54} rx={3.2} ry={3.8} fill={INK} />
          <Ellipse cx={60} cy={54} rx={3.2} ry={3.8} fill={INK} />
          {glint(41.1, 52.6)}
          {glint(61.1, 52.6)}
          <G {...stroke} strokeWidth={2.2}>
            <Path d="M35 49 L43.5 46" />
            <Path d="M65 49 L56.5 46" />
          </G>
        </G>
      );
    case 'angry':
      return (
        <G fill={INK}>
          <Path d="M35 49.5 L44.8 53 L44.8 55.5 Q40 60 35.3 55.5 Z" />
          <Path d="M65 49.5 L55.2 53 L55.2 55.5 Q60 60 64.7 55.5 Z" />
        </G>
      );
    default:
      return (
        <G>
          <Ellipse cx={40} cy={53} rx={3.4} ry={4.4} fill={INK} />
          <Ellipse cx={60} cy={53} rx={3.4} ry={4.4} fill={INK} />
          {glint(41.2, 51.3)}
          {glint(61.2, 51.3)}
        </G>
      );
  }
}

function Mouth({ mood }: { mood: OffyMood }) {
  switch (mood) {
    case 'joy':
      return <Path d="M41 62 Q50 71.5 59 62 Q50 66 41 62 Z" fill={INK} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />;
    case 'calm':
      return <Path d="M45.5 63.5 Q50 66.5 54.5 63.5" {...stroke} strokeWidth={2.4} />;
    case 'thinking':
      return <Path d="M46.5 65 Q50 63.5 54 64.5" {...stroke} strokeWidth={2.4} />;
    case 'anxious':
      return (
        <G>
          <Path d="M39 64.5 L61 64.5" {...stroke} strokeWidth={3} />
          <Path d="M67.5 43 Q70.5 47.5 67.5 49.5 Q64.5 47.5 67.5 43 Z" fill="#FFFFFF" opacity={0.85} />
        </G>
      );
    case 'fear':
      return <Path d="M41 65.5 q2.25 -2.6 4.5 0 t4.5 0 t4.5 0 t4.5 0" {...stroke} strokeWidth={2.3} />;
    case 'sad':
      return <Path d="M43.5 66.5 Q50 61.5 56.5 66.5" {...stroke} strokeWidth={2.6} />;
    case 'angry':
      return <Path d="M43.5 66 Q50 62.5 56.5 66" {...stroke} strokeWidth={2.8} />;
    case 'listening':
      return <Ellipse cx={50} cy={64.5} rx={2.4} ry={2} fill={INK} />;
    default:
      return <Path d="M46 63.5 Q50 66 54 63.5" {...stroke} strokeWidth={2.4} />;
  }
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
    <View style={[styles.dots, { top: size * 0.08, right: -size * 0.04, gap: dot * 0.6 }]} accessibilityLabel="A pensar">
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} t={t} dot={dot} color={colors.text} still={reduce} />
      ))}
    </View>
  );
}

function Dot({ i, t, dot, color, still }: { i: number; t: SharedValue<number>; dot: number; color: string; still: boolean }) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.6 };
    const phase = (t.value - i + 3) % 3;
    const on = phase < 1 ? phase : phase < 2 ? 2 - phase : 0;
    return { opacity: 0.25 + on * 0.65, transform: [{ translateY: -on * dot * 0.5 }] };
  });
  return <Animated.View style={[{ width: dot, height: dot, borderRadius: dot, backgroundColor: color }, style]} />;
}

/** Emoção do Offy a partir do que a pessoa escreve (palavras simples, sem enviar nada para fora). */
export function moodFromText(text: string): OffyMood | null {
  const t = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/(ansios|nervos|stress|agitad|nao paro|nao consigo parar|inquiet)/.test(t)) return 'anxious';
  if (/(medo|assust|panico|aterroriz|receio)/.test(t)) return 'fear';
  if (/(trist|sozinh|chor|deprim|em baixo|desanim|vazio)/.test(t)) return 'sad';
  if (/(raiva|irritad|odeio|furios|chatead|zangad)/.test(t)) return 'angry';
  if (/(recai|falhei|nao consegui|voltei a|desisti)/.test(t)) return 'calm';
  if (/(consegui|feliz|orgulh|cumpri|bom dia|obrigad|estou bem|melhor)/.test(t)) return 'joy';
  return null;
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
  dots: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
});
