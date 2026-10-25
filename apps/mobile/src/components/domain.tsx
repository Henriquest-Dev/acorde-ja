/** Componentes de domínio: AppUsageCard, AppLimitCard, AppHabitCard e AppBlockScreen. */
import { Feather } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { AppProgressBar } from './AppProgressBar';
import { AppText } from './AppText';
import { BrandIcon } from './brand';
import { AppCheckbox } from './controls';
import { RowIconView, type RowIcon } from './layout';
import { Breathe, PulseRings } from './motion';

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
  /** null = utilização desconhecida (sem permissão / plataforma sem suporte). */
  usedMin: number | null;
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
      accessibilityLabel={`${name}: ${usedMin ?? 'sem dados'} de ${limitMin} minutos${label ? `, ${label}` : ''}`}
      style={styles.usageRow}
    >
      <BrandIcon appId={appId} name={name} size={24} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppProgressBar progress={limitMin > 0 && usedMin !== null ? usedMin / limitMin : 0} height={4} />
        {label ? (
          <AppText variant="caption" tone="muted" style={{ fontSize: 10, lineHeight: 12 }}>
            {label}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" tone="secondary" style={styles.usageValue}>
        {usedMin ?? '—'} / {limitMin} min
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

/** Esqueleto partilhado pelos ecrãs «Limite atingido» e «80% do limite» — animado. */
export function AppBlockScreen({
  icon,
  title,
  message,
  children,
  footer,
  countdownTo,
  quotes,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  children?: ReactNode;
  footer?: string;
  /** Epoch ms em que a app volta a estar disponível (mostra contagem decrescente). */
  countdownTo?: number;
  /** Frases que alternam a cada 5 s. */
  quotes?: string[];
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!countdownTo && !quotes) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countdownTo, quotes]);
  const quote = quotes?.length ? quotes[Math.floor(now / 5000) % quotes.length] : null;
  const remaining = countdownTo ? Math.max(0, countdownTo - now) : 0;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const sec = Math.floor((remaining % 60_000) / 1000);
  return (
    <View style={[styles.block, { backgroundColor: colors.background, paddingTop: insets.top + 64, paddingBottom: insets.bottom + spacing.xxl }]}>
      <Animated.View entering={reduce ? undefined : FadeInDown.duration(380)} style={styles.blockInner}>
        <PulseRings size={170} color={colors.text}>
          <Breathe>{icon}</Breathe>
        </PulseRings>
        <AppText variant="h1" align="center" style={{ marginTop: spacing.lg, fontSize: 26 }} accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={{ marginTop: spacing.md, maxWidth: 300 }}>
          {message}
        </AppText>
        {countdownTo ? (
          <AppText variant="small" tone="muted" align="center" style={{ marginTop: spacing.sm, fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="polite">
            Disponível novamente em {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}min {String(sec).padStart(2, '0')}s
          </AppText>
        ) : null}
        {quote ? (
          <Animated.View key={quote} entering={reduce ? undefined : FadeIn.duration(400)} exiting={reduce ? undefined : FadeOut.duration(200)}>
            <AppText variant="small" tone="muted" align="center" style={{ marginTop: spacing.xl, maxWidth: 260 }}>
              {quote}
            </AppText>
          </Animated.View>
        ) : null}
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
