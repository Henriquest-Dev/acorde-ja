import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppBottomSheet, AppButton, AppSkeleton, AppText, Screen, toast, type RowIcon, RowIconView } from '@/components';
import { PermissionStatusIcon } from '@/features/onboarding/PermissionStatusIcon';
import { RestrictedSettingsHelp } from '@/features/onboarding/RestrictedSettingsHelp';
import { requestPermission, usePermissionSummary, type PermissionKey } from '@/features/onboarding/usePermissionSummary';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const ICONS: Record<PermissionKey, RowIcon> = {
  usage: { set: 'mci', name: 'cellphone-information' },
  apps: { set: 'mci', name: 'puzzle-outline' },
  sites: { set: 'mci', name: 'web' },
};


/** ONB-04 — Permissões necessárias (estado real confirmado pelo sistema). */
export default function Permissions() {
  const { colors } = useTheme();
  const { data, isLoading, refetch } = usePermissionSummary();
  const [info, setInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = data?.items ?? [];
  const pending = items.filter((i) => i.state !== 'granted' && i.state !== 'unsupported');

  const ask = async (key: PermissionKey) => {
    setBusy(true);
    try {
      await requestPermission(key);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível pedir a permissão', 'error');
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  return (
    <Screen
      testID="onb-permissions"
      footer={
        <View style={{ gap: spacing.md }}>
          {pending.length > 0 ? (
            <AppButton label="Conceder permissões" loading={busy} onPress={() => ask(pending[0]!.key)} testID="onb-grant" />
          ) : (
            <AppButton label="Continuar" onPress={() => router.push('/onboarding/done')} testID="onb-perms-continue" />
          )}
          <Pressable onPress={() => setInfo(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }}>
            <AppText variant="small" tone="muted">
              Mais informações
            </AppText>
          </Pressable>
          {pending.length > 0 ? (
            <Pressable onPress={() => router.push('/onboarding/done')} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }}>
              <AppText variant="caption" tone="muted">
                Continuar sem conceder agora
              </AppText>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View style={{ alignItems: 'center', marginTop: spacing.xxxl }}>
        <MaterialCommunityIcons name="shield-check-outline" size={56} color={colors.text} />
        <AppText variant="h2" align="center" style={{ marginTop: spacing.lg, fontSize: 24, lineHeight: 30 }} accessibilityRole="header">
          Permissões{'\n'}necessárias
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={{ marginTop: spacing.lg, maxWidth: 280 }}>
          Para bloquear aplicações e sites, precisamos de algumas permissões do sistema.
        </AppText>
      </View>
      <View style={{ marginTop: spacing.xxl, gap: spacing.xs }}>
        {isLoading
          ? [0, 1, 2].map((i) => <AppSkeleton key={i} height={44} />)
          : items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => (item.state === 'granted' || item.state === 'unsupported' ? setInfo(true) : ask(item.key))}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.state === 'granted' ? 'concedida' : item.state === 'unsupported' ? 'indisponível' : 'pendente'}`}
                style={styles.row}
                testID={`perm-${item.key}`}
              >
                <View style={{ width: 28, alignItems: 'center' }}>
                  <RowIconView icon={ICONS[item.key]} size={18} />
                </View>
                <AppText variant="small" style={{ flex: 1, fontSize: 13 }}>
                  {item.title}
                </AppText>
                <PermissionStatusIcon state={item.state} />
              </Pressable>
            ))}
      </View>
      <RestrictedSettingsHelp items={items} />
      {data?.caps.notes.length ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
          {data.caps.notes[0]}
        </AppText>
      ) : null}

      <AppBottomSheet visible={info} onClose={() => setInfo(false)} title="Sobre as permissões">
        <View style={{ gap: spacing.xl }}>
          {items.map((i) => (
            <View key={i.key} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <PermissionStatusIcon state={i.state} />
                <AppText variant="bodyStrong">{i.title}</AppText>
              </View>
              <AppText variant="small" tone="secondary">
                {i.description}
              </AppText>
              {i.state !== 'granted' ? (
                <AppText variant="caption" tone="muted">
                  {i.state === 'unsupported' ? 'Indisponível nesta plataforma. ' : `${i.unavailable} `}
                  {i.state !== 'unsupported' ? `Como activar: ${i.howTo}` : ''}
                </AppText>
              ) : null}
            </View>
          ))}
          <AppText variant="caption" tone="muted">
            Nunca lemos mensagens, palavras-passe nem dados financeiros. Pode revogar qualquer permissão nas definições do sistema.
          </AppText>
        </View>
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
});
