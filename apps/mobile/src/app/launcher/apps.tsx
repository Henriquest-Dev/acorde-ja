import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheet, AppButton, AppSkeleton, AppText, PressableScale, toast } from '@/components';
import { useLauncher, type LauncherEntry } from '@/features/launcher/useLauncher';
import { goBack } from '@/navigation/goBack';
import { groupByInitial } from '@/services/launcher';
import { MAX_FAVORITES, usePrefs } from '@/stores/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** Gaveta de apps — lista alfabética em texto, com limites e bloqueios visíveis. */
export default function LauncherApps() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { visible, apps, open } = useLauncher();
  const { prefs, update } = usePrefs();
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<LauncherEntry | null>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? visible.filter((a) => a.label.toLowerCase().includes(q)) : visible;
    return groupByInitial(filtered).map((g) => ({ title: g.letter, data: g.apps as LauncherEntry[] }));
  }, [visible, query]);

  const hiddenCount = prefs.launcher.hidden.length;
  const isFav = (p: string) => prefs.launcher.favorites.includes(p);

  const toggleFav = async (e: LauncherEntry) => {
    const favs = prefs.launcher.favorites;
    if (!isFav(e.packageName) && favs.length >= MAX_FAVORITES) return toast(`Máximo de ${MAX_FAVORITES} apps no ecrã inicial.`, 'error');
    await update((p) => ({ launcher: { ...p.launcher, favorites: isFav(e.packageName) ? favs.filter((x) => x !== e.packageName) : [...favs, e.packageName] } }));
    setMenu(null);
  };

  const hide = async (e: LauncherEntry) => {
    await update((p) => ({
      launcher: { ...p.launcher, hidden: [...p.launcher.hidden, e.packageName], favorites: p.launcher.favorites.filter((x) => x !== e.packageName) },
    }));
    setMenu(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.md }]} testID="launcher-apps">
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Procurar"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          autoCorrect={false}
          accessibilityLabel="Procurar app"
        />
        <PressableScale onPress={() => goBack('/launcher')} accessibilityRole="button" accessibilityLabel="Fechar" style={{ padding: 4 }}>
          <Feather name="x" size={18} color={colors.textMuted} />
        </PressableScale>
      </View>

      {apps.isLoading ? (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <AppSkeleton key={i} height={22} width={`${50 + i * 8}%`} />
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(a) => a.packageName}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <AppText variant="overline" tone="muted" style={{ marginTop: spacing.lg, marginBottom: 4 }}>
              {section.title}
            </AppText>
          )}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => void open(item)}
              onLongPress={() => setMenu(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}${item.locked ? ', bloqueada' : ''}`}
              accessibilityHint="Toque longo para mais opções"
              scaleTo={0.98}
              style={styles.row}
            >
              <AppText style={[styles.label, { color: item.locked ? colors.textMuted : colors.text, opacity: item.locked ? 0.5 : 1 }]}>{item.label}</AppText>
              {item.locked ? (
                <View style={[styles.pill, { borderColor: colors.borderStrong }]}>
                  <Feather name="lock" size={11} color={colors.textMuted} />
                  <AppText variant="caption" tone="muted" style={{ fontSize: 11 }}>
                    {item.lockLabel}
                  </AppText>
                </View>
              ) : item.usageLabel ? (
                <AppText variant="caption" tone="muted">
                  {item.usageLabel}
                </AppText>
              ) : null}
            </PressableScale>
          )}
          ListFooterComponent={
            hiddenCount > 0 ? (
              <PressableScale onPress={() => router.push('/settings/launcher')} accessibilityRole="button" style={{ marginTop: spacing.xl }}>
                <AppText variant="small" tone="muted">
                  {hiddenCount} {hiddenCount === 1 ? 'app escondida' : 'apps escondidas'} · gerir
                </AppText>
              </PressableScale>
            ) : undefined
          }
        />
      )}

      <AppBottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.label}>
        {menu ? (
          <View style={{ gap: spacing.sm }}>
            <AppButton label={isFav(menu.packageName) ? 'Retirar do ecrã inicial' : 'Pôr no ecrã inicial'} variant="subtle" onPress={() => void toggleFav(menu)} />
            <AppButton label="Esconder da gaveta" variant="subtle" onPress={() => void hide(menu)} />
            <AppButton
              label={menu.limit ? 'Alterar limite diário' : 'Definir limite diário'}
              variant="subtle"
              onPress={() => {
                setMenu(null);
                router.push('/settings/limits');
              }}
            />
          </View>
        ) : null}
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, height: 48 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, height: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontFamily: fonts.regular, fontSize: 21, letterSpacing: -0.3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
});
