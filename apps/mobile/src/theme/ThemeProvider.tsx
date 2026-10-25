import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ThemePreference = 'system' | 'dark' | 'light';

interface ThemeValue {
  colors: ThemeColors;
  scheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeValue>({ colors: darkColors, scheme: 'dark' });

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  // O produto é pensado primeiro para o modo escuro: "system" sem informação → escuro.
  const scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(() => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
