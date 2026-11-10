/**
 * Escolher o tempo diário de uma app: atalhos, barra (1 min a 24 h), − / + e escrever à mão.
 * A barra é mais fina nos valores pequenos (de 5 em 5 min) e larga nos grandes (de hora a hora).
 */
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppSlider, AppText } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

export const DURATION_MAX = 24 * 60;

/** Valores possíveis da barra. */
const STOPS: number[] = (() => {
  const out = [1, 2, 3];
  for (let m = 5; m <= 60; m += 5) out.push(m);
  for (let m = 75; m <= 240; m += 15) out.push(m);
  for (let m = 270; m <= 720; m += 30) out.push(m);
  for (let m = 780; m <= DURATION_MAX; m += 60) out.push(m);
  return out;
})();

const QUICK = [10, 20, 30, 60, 120, 180, 300];

const nearestStop = (m: number) => STOPS.reduce((best, s, i) => (Math.abs(s - m) < Math.abs(STOPS[best]! - m) ? i : best), 0);
const clamp = (m: number) => Math.max(1, Math.min(DURATION_MAX, Math.round(m)));

export function formatDurationLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (!h) return `${min} min`;
  return min ? `${h} h ${min} min` : `${h} h`;
}

export function DurationPicker({ value, onChange, disabled }: { value: number; onChange: (m: number) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const idx = nearestStop(value);
  const h = Math.floor(value / 60);
  const min = value % 60;
  const step = (dir: 1 | -1) => {
    const i = Math.max(0, Math.min(STOPS.length - 1, nearestStop(value) + dir));
    onChange(STOPS[i] === value ? clamp(value + dir) : STOPS[i]!);
  };

  return (
    <View style={{ opacity: disabled ? 0.4 : 1, gap: spacing.lg }} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.row}>
        <RoundBtn icon="minus" onPress={() => step(-1)} label="Menos tempo" />
        <AppText variant="display" align="center" style={{ flex: 1 }} testID="duration-value">
          {formatDurationLabel(value)}
        </AppText>
        <RoundBtn icon="plus" onPress={() => step(1)} label="Mais tempo" />
      </View>

      <AppSlider
        value={idx}
        min={0}
        max={STOPS.length - 1}
        step={1}
        onChange={(i) => onChange(STOPS[i]!)}
        accessibilityLabel="Tempo por dia"
        formatValue={(i) => formatDurationLabel(STOPS[i]!)}
      />
      <View style={styles.scale}>
        {['1 min', '1 h', '4 h', '12 h', '24 h'].map((t) => (
          <AppText key={t} variant="caption" tone="muted">
            {t}
          </AppText>
        ))}
      </View>

      <View style={styles.chips}>
        {QUICK.map((q) => {
          const on = q === value;
          return (
            <Pressable
              key={q}
              onPress={() => onChange(q)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                {
                  borderColor: on ? colors.text : colors.border,
                  backgroundColor: on ? colors.text : 'transparent',
                },
              ]}
            >
              <AppText variant="caption" weight="semibold" style={{ color: on ? colors.background : colors.text }}>
                {formatDurationLabel(q)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <AppText variant="small" tone="secondary" style={{ flex: 1 }}>
          Ou escreve
        </AppText>
        <NumberBox value={h} suffix="h" max={24} label="Horas" onChange={(v) => onChange(clamp(v * 60 + (v >= 24 ? 0 : min)))} />
        <NumberBox value={min} suffix="min" max={59} label="Minutos" onChange={(v) => onChange(clamp(h * 60 + v))} />
      </View>
    </View>
  );
}

function RoundBtn({ icon, onPress, label }: { icon: 'minus' | 'plus'; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.round, { borderColor: colors.border }]}
    >
      <Feather name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function NumberBox({
  value,
  suffix,
  max,
  label,
  onChange,
}: {
  value: number;
  suffix: string;
  max: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TextInput
        value={String(value)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/\D/g, '') || '0', 10);
          onChange(Math.min(max, n));
        }}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        accessibilityLabel={label}
        style={[styles.input, { color: colors.text }]}
      />
      <AppText variant="small" tone="muted">
        {suffix}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  box: {
    width: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.semibold,
    fontSize: 16,
    padding: 0,
    textAlign: 'right',
  },
});
