/** Componentes de domínio: AppUsageCard, AppLimitCard, AppHabitCard e AppBlockScreen. */
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { AppProgressBar } from './AppProgressBar';
import { AppText } from './AppText';
import { BrandIcon } from './brand';
import { AppCheckbox } from './controls';
import { RowIconView, type RowIcon } from './layout';

const STATE_LABEL: Record<string, string> = {
  WARNING: 'Perto do limite',
  BLOCKED: 'Bloqueado',
  TEMPORARY_EXCEPTION: 'Tempo extra',
  SCHEDULED_BLOCK: 'Horário de bloqueio',
  PERMISSION_REQUIRED: 'Sem permissão',
  UNAVAILABLE: 'Indisponível',
};

/** Linha de utilização de uma app no dashboard: ícone, barra e «18 / 30 min». */
export function AppUsageCard({
  appId,
  name,
  usedMin,
  limitMin,
  state,
  onPress,
}: {
  appId: string;
  name: string;
  usedMin: number;
  limitMin: number;
  state: string;
  onPress?: () => void;
}) {
  const label = STATE_LABEL[state];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}: ${usedMin} de ${limitMin} minutos${label ? `, ${label}` : ''}`}
      style={styles.usageRow}
    >
      <BrandIcon appId={appId} name={name} size={24} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppProgressBar progress={limitMin > 0 ? usedMin / limitMin : 0} height={4} />
        {label ? (
          <AppText variant="caption" tone="muted" style={{ fontSize: 10, lineHeight: 12 }}>
            {label}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" tone="secondary" style={styles.usageValue}>
        {usedMin} / {limitMin} min
      </AppText>
    </Pressable>
  );
}

/** Linha de limite (onboarding e definições): «Instagram · 30 minutos ›». */
export function AppLimitCard({ appId, name, minutes, enabled = true, onPress }: { appId: string; name: string; minutes: number; enabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, limite de ${minutes} minutos. Editar`}
      style={({ pressed }) => [styles.limitRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : enabled ? 1 : 0.5 }]}
    >
      <BrandIcon appId={appId} name={name} size={34} />
      <View style={{ flex: 1 }}>
        <AppText variant="small" weight="semibold" style={{ fontSize: 14 }}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {enabled ? `${minutes} minutos` : 'Sem limite'}
        </AppText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function AppHabitCard({
  icon,
  title,
  subtitle,
  done,
  onToggle,
  onPress,
}: {
  icon: RowIcon;
  title: string;
  subtitle?: string;
  done: boolean;
  onToggle: (v: boolean) => void;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes do hábito"
      style={[styles.habitRow, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={{ width: 28, alignItems: 'center' }}>
        <RowIconView icon={icon} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="small" weight="medium" style={{ fontSize: 14, textDecorationLine: 'none' }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppCheckbox checked={done} onChange={onToggle} accessibilityLabel={`Concluir ${title}`} />
    </Pressable>
  );
}

/** Esqueleto partilhado pelos ecrãs «Limite atingido» e «80% do limite». */
export function AppBlockScreen({ icon, title, message, children, footer }: { icon: ReactNode; title: string; message: string; children?: ReactNode; footer?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  return (
    <View style={[styles.block, { backgroundColor: colors.background, paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xxl }]}>
      <Animated.View entering={reduce ? undefined : FadeInDown.duration(380)} style={styles.blockInner}>
        <View style={styles.blockIcon}>{icon}</View>
        <AppText variant="h1" align="center" style={{ marginTop: spacing.xxl, fontSize: 26 }} accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={{ marginTop: spacing.md, maxWidth: 300 }}>
          {message}
        </AppText>
        {children}
      </Animated.View>
      {footer ? (
        <AppText variant="small" tone="muted" align="center" style={{ maxWidth: 260, alignSelf: 'center' }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  usageValue: { minWidth: 72, textAlign: 'right', fontSize: 12 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  block: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  blockInner: { alignItems: 'center' },
  blockIcon: { alignItems: 'center', justifyContent: 'center' },
});
