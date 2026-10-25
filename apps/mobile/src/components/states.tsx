/** AppSkeleton, AppEmptyState, AppErrorState e AppPermissionCard. */
import { Feather } from '@expo/vector-icons';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { AppButton } from './AppButton';
import { AppCard } from './AppCard';
import { AppText } from './AppText';

type IconName = ComponentProps<typeof Feather>['name'];

export function AppSkeleton({ width = '100%', height = 16, radius = radii.sm, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [reduce, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityLabel="A carregar"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.elevated }, anim, style]}
    />
  );
}

export function AppEmptyState({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, { borderColor: colors.borderStrong }]}>
        <Feather name={icon} size={26} color={colors.text} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="small" tone="muted" align="center" style={{ maxWidth: 300 }}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <AppButton label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: spacing.sm, alignSelf: 'center' }} /> : null}
    </View>
  );
}

export function AppErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <AppEmptyState icon="alert-triangle" title="Algo correu mal" message={message} actionLabel={onRetry ? 'Tentar novamente' : undefined} onAction={onRetry} />;
}

export type PermissionUiState = 'granted' | 'denied' | 'not_determined' | 'unsupported';

/** Cartão de permissão: explica a finalidade e mostra o estado REAL confirmado pelo sistema. */
export function AppPermissionCard({
  icon,
  title,
  description,
  state,
  onRequest,
  actionLabel = 'Activar',
}: {
  icon: IconName;
  title: string;
  description: string;
  state: PermissionUiState;
  onRequest?: () => void;
  actionLabel?: string;
}) {
  const { colors } = useTheme();
  const label = { granted: 'Concedida', denied: 'Pendente', not_determined: 'Pendente', unsupported: 'Indisponível' }[state];
  return (
    <AppCard>
      <View style={styles.permRow}>
        <Feather name={icon} size={20} color={colors.text} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="small" tone="muted">
            {description}
          </AppText>
        </View>
        <View style={[styles.badge, { borderColor: colors.borderStrong, backgroundColor: state === 'granted' ? colors.accent : 'transparent' }]}>
          <AppText variant="caption" weight="semibold" style={{ color: state === 'granted' ? colors.onAccent : colors.textSecondary }}>
            {label}
          </AppText>
        </View>
      </View>
      {state !== 'granted' && state !== 'unsupported' && onRequest ? (
        <AppButton label={actionLabel} variant="secondary" size="sm" onPress={onRequest} style={{ marginTop: spacing.md }} />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  iconCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  permRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  badge: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
});
