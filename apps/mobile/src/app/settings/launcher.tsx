import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { AppBottomSheet, AppCard, AppCheckbox, AppHeader, AppSlider, AppSwitch, AppText, ListRow, Screen, SectionTitle, toast } from '@/components';
import { enableAsHome, isDefaultHome, launcherSupported, listLauncherApps, openGrayscaleSettings, openHomeSettings } from '@/services/launcher';
import { MAX_FAVORITES, usePrefs, type LauncherPrefs } from '@/stores/prefs';
import { spacing } from '@/theme/tokens';

/** Definições do launcher minimalista. */
export default function LauncherSettings() {
  const { prefs, update } = usePrefs();
  const l = prefs.launcher;
  const apps = useQuery({ queryKey: ['launcher-apps'], queryFn: listLauncherApps, staleTime: 5 * 60_000 });
  const isHome = useQuery({ queryKey: ['is-default-home'], queryFn: isDefaultHome });
  const [picker, setPicker] = useState<'favorites' | 'hidden' | null>(null);

  const set = (patch: Partial<LauncherPrefs>) => update((p) => ({ launcher: { ...p.launcher, ...patch } }));

  const toggleHome = async (on: boolean) => {
    if (!launcherSupported) return toast('O launcher só está disponível no Android.', 'error');
    await set({ enabled: on });
    await enableAsHome(on);
    if (on) toast('Escolha «offly» como app de Início.');
  };

  const toggleIn = (key: 'favorites' | 'hidden', pkg: string) => {
    const list = l[key];
    if (key === 'favorites' && !list.includes(pkg) && list.length >= MAX_FAVORITES) return toast(`Máximo de ${MAX_FAVORITES} apps.`, 'error');
    void set({ [key]: list.includes(pkg) ? list.filter((x) => x !== pkg) : [...list, pkg] } as Partial<LauncherPrefs>);
  };

  return (
    <Screen testID="launcher-settings">
      <AppHeader title="Launcher" back />
      <AppCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Usar o offly como ecrã inicial</AppText>
            <AppText variant="caption" tone="muted">
              {isHome.data ? 'O offly é o seu ecrã inicial.' : 'Substitui o ecrã inicial por uma versão só com texto.'}
            </AppText>
          </View>
          <AppSwitch value={l.enabled} onValueChange={(v) => void toggleHome(v)} accessibilityLabel="Usar o offly como ecrã inicial" />
        </View>
        {l.enabled && isHome.data === false ? (
          <AppText variant="small" style={{ marginTop: spacing.md, textDecorationLine: 'underline' }} onPress={() => void openHomeSettings()}>
            Escolher o offly nas definições de Início
          </AppText>
        ) : null}
      </AppCard>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <ListRow icon={{ set: 'feather', name: 'home' }} title="Ver o launcher" chevron onPress={() => router.push('/launcher')} />
        <ListRow icon={{ set: 'feather', name: 'star' }} title="Apps no início" subtitle={l.favorites.length ? `${l.favorites.length} escolhidas` : 'Automático (essenciais)'} chevron onPress={() => setPicker('favorites')} />
        <ListRow icon={{ set: 'feather', name: 'eye-off' }} title="Esconder apps" subtitle={`${l.hidden.length} escondidas da gaveta`} chevron onPress={() => setPicker('hidden')} />
      </View>

      <SectionTitle>Pausa antes de abrir</SectionTitle>
      <AppText variant="small" tone="secondary">
        {l.intentionSeconds > 0 ? `${l.intentionSeconds} segundos nas apps com limite` : 'Desligada'}
      </AppText>
      <AppSlider value={l.intentionSeconds} min={0} max={30} step={5} onChange={(v) => void set({ intentionSeconds: v })} accessibilityLabel="Segundos de pausa" formatValue={(v) => `${v} segundos`} />

      <SectionTitle>Ecrã inicial</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        <ListRow title="Mostrar tempo de ecrã" subtitle="No ecrã inicial" right={<AppSwitch value={l.showUsage} onValueChange={(v) => void set({ showUsage: v })} accessibilityLabel="Mostrar tempo de ecrã" />} />
        <ListRow
          title="Trancar durante o desafio"
          subtitle="Pede para voltar se trocar de ecrã inicial"
          right={<AppSwitch value={l.lockDuringChallenge} onValueChange={(v) => void set({ lockDuringChallenge: v })} accessibilityLabel="Trancar durante o desafio" />}
        />
        <ListRow
          title="Ecrã a preto e branco"
          subtitle="Abre a correcção de cor do sistema"
          chevron
          onPress={() => (Platform.OS === 'android' ? void openGrayscaleSettings() : toast('Disponível no Android.', 'error'))}
        />
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
        O Android permite sempre trocar de ecrã inicial nas definições. Se isso acontecer, os limites, o bloqueio e a proteção de sites
        continuam activos na mesma.
      </AppText>

      <AppBottomSheet visible={picker !== null} onClose={() => setPicker(null)} title={picker === 'favorites' ? `Apps no início (máx. ${MAX_FAVORITES})` : 'Esconder apps'}>
        <FlatList
          style={{ maxHeight: 460 }}
          data={apps.data ?? []}
          keyExtractor={(a) => a.packageName}
          renderItem={({ item }) => (
            <ListRow
              card={false}
              title={item.label}
              onPress={() => picker && toggleIn(picker, item.packageName)}
              right={
                <AppCheckbox
                  checked={picker ? l[picker].includes(item.packageName) : false}
                  onChange={() => picker && toggleIn(picker, item.packageName)}
                  accessibilityLabel={item.label}
                />
              }
            />
          )}
        />
      </AppBottomSheet>
    </Screen>
  );
}
