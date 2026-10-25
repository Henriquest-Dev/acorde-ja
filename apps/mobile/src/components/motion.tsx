/**
 * Micro-animações partilhadas. Todas respeitam «Reduzir movimento» do sistema.
 * Animações subtis e curtas: dão resposta ao toque, não incentivam uso compulsivo.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, type AppTextProps } from './AppText';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable que encolhe ligeiramente ao toque (resposta táctil visual). */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduce) s.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) s.set(withSpring(1, { damping: 14, stiffness: 300 }));
        rest.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Entrada em cascata para itens de listas. */
export function FadeInItem({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 10) * 55).duration(360).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
}

/** Número que conta até ao valor (ex.: minutos no anel do dashboard). */
export function AnimatedNumber({ value, format = String, duration = 700, ...text }: { value: number; format?: (n: number) => string; duration?: number } & AppTextProps) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce) {
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const from = shown;
    const start = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a mudanças do valor final
  }, [value, reduce, duration]);
  return <AppText {...text}>{format(shown)}</AppText>;
}

/** Ponto a pulsar que indica dados em tempo real. */
export function LivePulse({ color, size = 8 }: { color: string; size?: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [reduce, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View accessibilityLabel="Em tempo real" style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, anim]} />;
}

/** Leve "respiração" contínua (escala) — usado no ecrã de bloqueio e em destaques. */
export function Breathe({ children, style, amount = 0.04, period = 2400 }: { children: ReactNode; style?: StyleProp<ViewStyle>; amount?: number; period?: number }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!reduce) s.value = withRepeat(withSequence(withTiming(1 + amount, { duration: period / 2 }), withTiming(1, { duration: period / 2 })), -1);
  }, [reduce, s, amount, period]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Anéis concêntricos que se expandem à volta de um elemento (ecrã de bloqueio). */
export function PulseRings({ size = 180, color, children }: { size?: number; color: string; children?: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {reduce ? null : [0, 1, 2].map((k) => <Ring key={k} delay={k * 800} size={size} color={color} />)}
      {children}
    </Animated.View>
  );
}

function Ring({ delay, size, color }: { delay: number; size: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      p.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
    }, delay);
    return () => clearTimeout(t);
  }, [delay, p]);
  const anim = useAnimatedStyle(() => ({ opacity: (1 - p.value) * 0.55, transform: [{ scale: 0.4 + 0.6 * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color }, anim]} />;
}
