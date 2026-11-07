/**
 * Movimento mínimo. Só há duas animações: um toque que encolhe 2% e uma
 * entrada em fade curta. Nada pulsa, respira nem se repete — o offly serve
 * para largar o ecrã, não para o prender. Respeita «Reduzir movimento».
 */
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable que escurece e encolhe ligeiramente ao toque. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.98,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 1 - (1 - s.value) * 8 }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduce) s.set(withTiming(Math.max(scaleTo, 0.98), { duration: 90, easing: Easing.out(Easing.quad) }));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) s.set(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }));
        rest.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Entrada em fade curta (sem deslocamento nem cascata). `index` mantém-se por compatibilidade. */
export function FadeInItem({ children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} style={style}>
      {children}
    </Animated.View>
  );
}
