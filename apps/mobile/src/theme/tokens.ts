/**
 * Design system Black & White Premium.
 * A interface própria usa exclusivamente tons monocromáticos; apenas os
 * logótipos de aplicações externas mantêm as suas cores oficiais.
 */

export const palette = {
  black: '#000000',
  black2: '#0A0A0A',
  surface: '#111111',
  card: '#171717',
  elevated: '#222222',
  border: '#303030',
  gray: '#888888',
  grayLight: '#CCCCCC',
  white: '#FFFFFF',
  lightBg: '#F7F7F7',
} as const;

export interface ThemeColors {
  background: string;
  backgroundAlt: string;
  surface: string;
  card: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** Cor de destaque (botão primário, anel, checkbox activo). */
  accent: string;
  /** Texto sobre `accent`. */
  onAccent: string;
  track: string;
  overlay: string;
}

export const darkColors: ThemeColors = {
  background: palette.black,
  backgroundAlt: palette.black2,
  surface: palette.surface,
  card: palette.card,
  elevated: palette.elevated,
  border: '#262626',
  borderStrong: palette.border,
  text: palette.white,
  textSecondary: palette.grayLight,
  textMuted: palette.gray,
  accent: palette.white,
  onAccent: palette.black,
  track: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.72)',
};

export const lightColors: ThemeColors = {
  background: palette.lightBg,
  backgroundAlt: palette.white,
  surface: palette.white,
  card: palette.white,
  elevated: '#EDEDED',
  border: '#E3E3E3',
  borderStrong: palette.grayLight,
  text: palette.black,
  textSecondary: '#333333',
  textMuted: '#6E6E6E',
  accent: palette.black,
  onAccent: palette.white,
  track: '#E2E2E2',
  overlay: 'rgba(0,0,0,0.45)',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
} as const;
export type TypographyVariant = keyof typeof typography;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const layout = {
  screenPadding: 20,
  minTouch: 44,
} as const;
