import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

export function AppProgressBar({
  progress,
  height = 4,
  style,
  accessibilityLabel,
}: {
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const w = useSharedValue(0);
  useEffect(() => {
    const v = Math.max(0, Math.min(1, progress));
    w.value = reduce ? v : withTiming(v, { duration: 600 });
  }, [progress, reduce, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, progress) * 100) }}
      style={[styles.track, { height, borderRadius: height, backgroundColor: colors.track }, style]}
    >
      <Animated.View style={[styles.fill, { borderRadius: height, backgroundColor: colors.accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
