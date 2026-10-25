import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from './AppText';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Texto do valor apresentado ao tocar (ex.: "1h 35min"). */
  valueLabel: string;
}

/**
 * Gráfico de barras monocromático e interactivo (toque numa barra para ver o
 * valor). As barras crescem a partir de baixo e animam quando os dados mudam
 * (gráficos em tempo real). Sem cor: degradé branco→cinzento; a barra
 * seleccionada (ou `highlightKey`, ex.: a hora actual) fica sólida.
 */
export function AppBarChart({
  data,
  height = 120,
  yTicks,
  highlightKey,
  testID,
}: {
  data: BarDatum[];
  height?: number;
  /** Etiquetas do eixo Y de cima para baixo (ex.: ["4h","3h","2h","1h","0h"]). */
  yTicks?: string[];
  highlightKey?: string;
  testID?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const sel = data.find((d) => d.key === selected);
  return (
    <View testID={testID}>
      <View style={{ height: 22, alignItems: 'center' }}>
        {sel ? (
          <AppText variant="caption" weight="semibold">
            {sel.label} · {sel.valueLabel}
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {yTicks ? (
          <View style={{ height, justifyContent: 'space-between', marginRight: spacing.sm }}>
            {yTicks.map((t) => (
              <AppText key={t} variant="caption" tone="muted" style={{ fontSize: 10, lineHeight: 12 }}>
                {t}
              </AppText>
            ))}
          </View>
        ) : null}
        <View style={[styles.bars, { height }]}>
          {data.map((d, i) => (
            <Bar
              key={d.key}
              datum={d}
              index={i}
              target={Math.max(d.value > 0 ? 3 : 0, (d.value / max) * height)}
              active={selected === d.key || highlightKey === d.key}
              onPress={() => setSelected(selected === d.key ? null : d.key)}
            />
          ))}
        </View>
      </View>
      <View style={[styles.labels, yTicks ? { marginLeft: 22 } : null]}>
        {data.map((d) => (
          <AppText key={d.key} variant="caption" tone={selected === d.key || highlightKey === d.key ? 'primary' : 'muted'} style={styles.label} numberOfLines={1}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function Bar({ datum, index, target, active, onPress }: { datum: BarDatum; index: number; target: number; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const h = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    h.value = reduce ? target : withDelay(index * 35, withTiming(target, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [target, reduce, index, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Pressable style={styles.barCol} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${datum.label}: ${datum.valueLabel}`}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
        <Animated.View style={[{ width: '58%', borderRadius: 3, overflow: 'hidden' }, style]}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={`bar-${datum.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.text} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.text} stopOpacity={active ? 1 : 0.3} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bar-${datum.key})`} />
          </Svg>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, height: '100%' },
  labels: { flexDirection: 'row', marginTop: spacing.sm },
  label: { flex: 1, textAlign: 'center' },
});
