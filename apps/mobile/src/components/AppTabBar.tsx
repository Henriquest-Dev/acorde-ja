import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

const ICONS: Record<string, (color: string, focused: boolean) => React.ReactNode> = {
  index: (c, f) => <MaterialCommunityIcons name={f ? 'home-variant' : 'home-variant-outline'} size={22} color={c} />,
  protection: (c) => <MaterialCommunityIcons name="shield-check-outline" size={22} color={c} />,
  focus: (c) => <Feather name="clock" size={20} color={c} />,
  progress: (c) => <MaterialCommunityIcons name="chart-bar" size={22} color={c} />,
  assistant: (c) => <MaterialCommunityIcons name="robot-outline" size={22} color={c} />,
};

/** Barra de separadores: Início, Protecção, Foco, Progresso, IA. */
export function AppTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key]!;
        const label = (options.title ?? route.name) as string;
        const color = focused ? colors.text : colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            testID={`tab-${route.name}`}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                void Haptics.selectionAsync().catch(() => undefined);
                navigateToTab(route.key);
              }
            }}
            style={styles.item}
          >
            {ICONS[route.name]?.(color, focused)}
            <AppText variant="caption" style={{ color, fontSize: 10, marginTop: 3 }} weight={focused ? 'semibold' : 'regular'}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
