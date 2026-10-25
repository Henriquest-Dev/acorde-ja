import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
 * valor). Sem cor: as barras usam um degradé branco→cinzento e a barra
 * seleccionada fica sólida.
 */
export function AppBarChart({
  data,
  height = 120,
  yTicks,
  testID,
}: {
  data: BarDatum[];
  height?: number;
  /** Etiquetas do eixo Y de cima para baixo (ex.: ["4h","3h","2h","1h","0h"]). */
  yTicks?: string[];
  testID?: string;
}) {
  const { colors } = useTheme();
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
          {data.map((d) => {
            const h = Math.max(d.value > 0 ? 4 : 0, (d.value / max) * height);
            const active = selected === d.key;
            return (
              <Pressable
                key={d.key}
                style={styles.barCol}
                onPress={() => setSelected(active ? null : d.key)}
                accessibilityRole="button"
                accessibilityLabel={`${d.label}: ${d.valueLabel}`}
              >
                <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                  <Svg width="58%" height={h}>
                    <Defs>
                      <LinearGradient id={`bar-${d.key}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors.text} stopOpacity={1} />
                        <Stop offset="1" stopColor={colors.text} stopOpacity={active ? 1 : 0.35} />
                      </LinearGradient>
                    </Defs>
                    <Rect x={0} y={0} width="100%" height={h} rx={2} fill={`url(#bar-${d.key})`} />
                  </Svg>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={[styles.labels, yTicks ? { marginLeft: 22 } : null]}>
        {data.map((d) => (
          <AppText key={d.key} variant="caption" tone={selected === d.key ? 'primary' : 'muted'} style={styles.label}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, height: '100%' },
  labels: { flexDirection: 'row', marginTop: spacing.sm },
  label: { flex: 1, textAlign: 'center' },
});
