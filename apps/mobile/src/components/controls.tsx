/** Controlos de formulário: AppSwitch, AppCheckbox, AppRadioGroup, AppSlider, SegmentedControl. */
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

const tick = () => void Haptics.selectionAsync().catch(() => undefined);

export function AppSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  testID,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = reduce ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, reduce, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        tick();
        onValueChange(!value);
      }}
      style={[
        styles.switchTrack,
        { backgroundColor: value ? colors.textMuted : colors.track, borderColor: colors.borderStrong, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Animated.View style={[styles.switchKnob, { backgroundColor: value ? colors.accent : colors.textMuted }, knob]} />
    </Pressable>
  );
}

export function AppCheckbox({
  checked,
  onChange,
  accessibilityLabel,
  disabled,
  testID,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        tick();
        onChange(!checked);
      }}
      style={[
        styles.checkbox,
        { borderColor: checked ? colors.accent : colors.textMuted, backgroundColor: checked ? colors.accent : 'transparent' },
      ]}
    >
      {checked ? <Feather name="check" size={15} color={colors.onAccent} /> : null}
    </Pressable>
  );
}

export function AppRadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => {
              tick();
              onChange(o.value);
            }}
            style={[styles.radioRow, { borderColor: selected ? colors.text : colors.border, backgroundColor: colors.card }]}
          >
            <View style={[styles.radioOuter, { borderColor: selected ? colors.text : colors.textMuted }]}>
              {selected ? <View style={[styles.radioInner, { backgroundColor: colors.text }]} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{o.label}</AppText>
              {o.description ? (
                <AppText variant="small" tone="muted">
                  {o.description}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Slider discreto (passos inteiros), acessível por gestos e por botões de ajuste. */
export function AppSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  accessibilityLabel,
  formatValue = String,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accessibilityLabel: string;
  formatValue?: (v: number) => string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const ratio = (value - min) / (max - min);
  const clampStep = (raw: number) => Math.min(max, Math.max(min, Math.round(raw / step) * step));

  const fromX = (x: number) => {
    if (width <= 0) return;
    const next = clampStep(min + (Math.max(0, Math.min(width, x)) / width) * (max - min));
    if (next !== value) onChange(next);
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(fromX)(e.x))
    .onUpdate((e) => runOnJS(fromX)(e.x));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: formatValue(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(clampStep(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.sliderHit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.sliderTrack, { backgroundColor: colors.track }]}>
            <View style={[styles.sliderFill, { width: `${ratio * 100}%`, backgroundColor: colors.accent }]} />
          </View>
          <View style={[styles.sliderKnob, { left: Math.max(0, ratio * width - 12), backgroundColor: colors.accent }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessibilityRole="tablist" style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            onPress={() => {
              tick();
              onChange(o.value);
            }}
            style={[styles.segmentItem, active && { backgroundColor: colors.accent }]}
          >
            <AppText variant="small" weight={active ? 'semibold' : 'medium'} style={{ color: active ? colors.onAccent : colors.textMuted }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switchTrack: { width: 46, height: 26, borderRadius: 13, padding: 2, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  switchKnob: { width: 20, height: 20, borderRadius: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  sliderHit: { height: 36, justifyContent: 'center' },
  sliderTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  sliderFill: { height: 4 },
  sliderKnob: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 6 },
  segment: { flexDirection: 'row', borderRadius: radii.md, padding: 3, borderWidth: StyleSheet.hairlineWidth },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: radii.sm },
});
