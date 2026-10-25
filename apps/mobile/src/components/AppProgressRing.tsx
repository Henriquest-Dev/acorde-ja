import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface AppProgressRingProps {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  accessibilityLabel?: string;
  /** Desenha o fundo do anel (pista). */
  showTrack?: boolean;
}

/** Anel de progresso animado (dashboard e temporizador de foco). */
export function AppProgressRing({ progress, size = 200, strokeWidth = 10, children, accessibilityLabel, showTrack = true }: AppProgressRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    value.value = reduceMotion ? clamped : withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - value.value) }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, progress) * 100) }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {showTrack ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={strokeWidth} fill="none" /> : null}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
