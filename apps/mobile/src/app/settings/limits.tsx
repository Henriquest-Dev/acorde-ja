import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { AppBottomSheet, AppButton, AppEmptyState, AppHeader, AppInput, AppLimitCard, AppSkeleton, AppText, BrandIcon, ListRow, Screen, toast } from '@/components';
import { LimitEditorSheet } from '@/features/limits/LimitEditorSheet';
import { useLimits } from '@/hooks/queries';
import { getInstalledApps, isNativeAvailable } from '@/native/device';
import type { AppLimit } from '@/repositories/limits';
import { spacing } from '@/theme/tokens';

/** Limites de aplicações: editar, remover e adicionar apps instaladas (Android). */
export default function LimitsSettings() {
  const { data: limits, isLoading } = useLimits();
  const [editing, setEditing] = useState<AppLimit | null>(null);
  const [picker, setPicker] = useState(false);
  const [filter, setFilter] = useState('');
  const installed = useQuery({ queryKey: ['installed-apps'], queryFn: getInstalledApps, enabled: picker });
  const total = (limits ?? []).filter((l) => l.enabled).reduce((s, l) => s + l.limitMinutes, 0);

  return (
    <Screen>
      <AppHeader title="Limites de aplicações" back />
      <View style={{ gap: spacing.md }}>
        {isLoading
          ? [0, 1, 2].map((i) => <AppSkeleton key={i} height={60} />)
          : limits?.map((l) => <AppLimitCard key={l.appId} appId={l.appId} name={l.name} minutes={l.limitMinutes} enabled={l.enabled} onPress={() => setEditing(l)} />)}
      </View>
      <AppText variant="small" tone="muted" align="center" style={{ marginTop: spacing.lg }}>
        Total diário: {total} minutos
      </AppText>
      <AppButton
        label="Adicionar aplicação"
        variant="secondary"
        style={{ marginTop: spacing.xl }}
        onPress={() => (isNativeAvailable ? setPicker(true) : toast('A lista de aplicações instaladas só está disponível no Android.', 'error'))}
      />
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        Os limites reiniciam todos os dias à meia-noite (hora local). Aviso aos 80%, bloqueio aos 100%.
      </AppText>

      <LimitEditorSheet limit={editing} allowDelete onClose={() => setEditing(null)} />

      <AppBottomSheet visible={picker} onClose={() => setPicker(false)} title="Escolher aplicação">
        <AppInput placeholder="Procurar" value={filter} onChangeText={setFilter} />
        {installed.isLoading ? (
          <AppSkeleton height={300} style={{ marginTop: spacing.md }} />
        ) : installed.data?.length ? (
          <FlatList
            style={{ marginTop: spacing.md, maxHeight: 420 }}
            data={installed.data.filter((a) => a.label.toLowerCase().includes(filter.toLowerCase()) && !limits?.some((l) => l.packageNames.includes(a.packageName)))}
            keyExtractor={(a) => a.packageName}
            renderItem={({ item }) => (
              <ListRow
                card={false}
                leading={<BrandIcon appId={item.packageName} name={item.label} iconBase64={item.iconBase64} size={32} />}
                title={item.label}
                subtitle={item.packageName}
                onPress={() => {
                  setPicker(false);
                  setEditing({ appId: item.packageName, name: item.label, packageNames: [item.packageName], limitMinutes: 30, enabled: true, sort: 99 });
                }}
              />
            )}
          />
        ) : (
          <AppEmptyState icon="smartphone" title="Sem aplicações" message="Não foi possível ler as aplicações instaladas." />
        )}
      </AppBottomSheet>
    </Screen>
  );
}
