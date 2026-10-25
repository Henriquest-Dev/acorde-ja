/** Screen, AppHeader e ListRow — estrutura base dos ecrãs. */
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radii, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './motion';

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  contentStyle,
  edges = ['top'],
  footer,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
  footer?: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top + spacing.md : spacing.md,
    paddingBottom: (edges.includes('bottom') ? insets.bottom : 0) + spacing.xxl,
    paddingHorizontal: padded ? layout.screenPadding : 0,
  };
  return (
    <Animated.View testID={testID} entering={reduce ? undefined : FadeIn.duration(220)} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl tintColor={colors.text} refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: layout.screenPadding, paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.sm }}>{footer}</View>
      ) : null}
    </Animated.View>
  );
}

export function AppHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
  large = true,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={12}
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant={large ? 'h2' : 'h3'} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function HeaderIconButton({ icon, onPress, label }: { icon: ComponentProps<typeof Feather>['name']; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { borderColor: colors.borderStrong, opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

export type RowIcon =
  | { set: 'feather'; name: ComponentProps<typeof Feather>['name'] }
  | { set: 'mci'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] };

export function RowIconView({ icon, size = 20, color }: { icon: RowIcon; size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  return icon.set === 'feather' ? <Feather name={icon.name} size={size} color={c} /> : <MaterialCommunityIcons name={icon.name} size={size + 2} color={c} />;
}

export function ListRow({
  icon,
  leading,
  title,
  subtitle,
  right,
  chevron,
  onPress,
  card = true,
  testID,
  accessibilityLabel,
}: {
  icon?: RowIcon;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  card?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading ?? (icon ? <View style={styles.rowIcon}><RowIconView icon={icon} /></View> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="small" weight="medium" style={{ fontSize: 14 }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron ? <Feather name="chevron-right" size={18} color={colors.textMuted} /> : null}
    </>
  );
  const style = [styles.row, card && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }];
  if (!onPress) {
    return (
      <View style={style} testID={testID} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={style} scaleTo={0.98}>
      {content}
    </PressableScale>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong" accessibilityRole="header">
        {children}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl, minHeight: 40 },
  back: { width: 32, height: 40, justifyContent: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.md },
  rowIcon: { width: 28, alignItems: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md },
});
