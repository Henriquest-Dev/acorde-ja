import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppLimitCard, AppSkeleton, AppText, Screen } from '@/components';
import { LimitEditorSheet } from '@/features/limits/LimitEditorSheet';
import { useLimits } from '@/hooks/queries';
import type { AppLimit } from '@/repositories/limits';
import { spacing } from '@/theme/tokens';

/** ONB-03 — Limites iniciais (editáveis). */
export default function Limits() {
  const { data: limits, isLoading } = useLimits();
  const [editing, setEditing] = useState<AppLimit | null>(null);
  const total = (limits ?? []).filter((l) => l.enabled).reduce((s, l) => s + l.limitMinutes, 0);

  return (
    <Screen testID="onb-limits" footer={<AppButton label="Continuar" onPress={() => router.push('/onboarding/permissions')} testID="onb-limits-continue" />}>
      <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.xxl, fontSize: 24, lineHeight: 30 }} accessibilityRole="header">
        Defina os seus{'\n'}limites diários
      </AppText>
      <View style={{ gap: spacing.md }}>
        {isLoading
          ? [0, 1, 2, 3].map((i) => <AppSkeleton key={i} height={60} radius={12} />)
          : limits?.map((l) => <AppLimitCard key={l.appId} appId={l.appId} name={l.name} minutes={l.limitMinutes} enabled={l.enabled} onPress={() => setEditing(l)} />)}
      </View>
      <AppText variant="small" tone="muted" align="center" style={{ marginTop: spacing.xl }} testID="limits-total">
        Total diário: {total} minutos
      </AppText>
      <LimitEditorSheet limit={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
