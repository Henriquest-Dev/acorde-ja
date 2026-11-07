import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
 * Gráfico de barras sóbrio: barras planas, sem degradé nem animação, sobre uma
 * linha de base. A barra em destaque (hora actual / selecionada) é branca; as
 * restantes são cinzentas. A linha de cima diz sempre o que está a ver.
 */
export function AppBarChart({
  data,
  height = 96,
  highlightKey,
  testID,
}: {
  data: BarDatum[];
  height?: number;
  /** Barra em destaque por omissão (ex.: a hora actual). */
  highlightKey?: string;
  yTicks?: string[];
  testID?: string;
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const activeKey = selected ?? highlightKey ?? null;
  const active = data.find((d) => d.key === activeKey);
  return (
    <View testID={testID}>
      <AppText variant="caption" tone="secondary" style={{ minHeight: 18 }}>
        {active ? `${active.label || active.key} · ${active.valueLabel}` : 'Toque numa barra'}
      </AppText>
      <View style={[styles.bars, { height, borderBottomColor: colors.borderStrong, marginTop: spacing.sm }]}>
        {data.map((d) => {
          const on = d.key === activeKey;
          const h = d.value > 0 ? Math.max(3, Math.round((d.value / max) * height)) : 0;
          return (
            <Pressable
              key={d.key}
              style={styles.col}
              onPress={() => setSelected(selected === d.key ? null : d.key)}
              accessibilityRole="button"
              accessibilityLabel={`${d.label || d.key}: ${d.valueLabel}`}
            >
              <View style={{ width: '62%', height: h, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: on ? colors.text : colors.textMuted, opacity: on ? 1 : 0.45 }} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <AppText key={d.key} variant="caption" tone={d.key === activeKey ? 'primary' : 'muted'} style={styles.label} numberOfLines={1}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  labels: { flexDirection: 'row', marginTop: spacing.xs },
  label: { flex: 1, textAlign: 'center', fontSize: 10 },
});
