/**
 * Design tokens for Rantai-Agent-Mobile.
 *
 * Adapted from the RantAI-Agents web design system (shadcn/ui + Tailwind v4).
 * The web oklch values have been converted to HEX for React Native. Aesthetic:
 * warm off-white + monochrome black actions + brand blue accent (#0071DF).
 *
 * Note: the keys `background`, `text`, `backgroundElement`, `backgroundSelected`,
 * `textSecondary` are kept for compatibility with older components.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0B0B', // foreground
    textSecondary: '#555555', // muted-foreground
    background: '#F9F8F7', // warm off-white
    card: '#FFFFFF',
    backgroundElement: '#EFEBE4', // secondary
    backgroundSelected: '#E8E4DD', // muted
    primary: '#0B0B0B', // primary action (black)
    primaryForeground: '#F9F8F7',
    accent: '#0071DF', // brand blue
    accentForeground: '#FFFFFF',
    border: '#DBD7D0',
    destructive: '#E7000B',
  },
  dark: {
    text: '#FAFAFA',
    textSecondary: '#A1A1A1',
    background: '#1E1E20', // dark grey (not pure black #000)
    card: '#282829', // slightly lighter than background so cards stand out
    backgroundElement: '#333335',
    backgroundSelected: '#3D3D40',
    primary: '#FAFAFA',
    primaryForeground: '#0A0A0A',
    accent: '#0071DF', // blue still used for links/highlights
    accentForeground: '#FFFFFF',
    border: '#3A3A3C',
    destructive: '#82181A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Border-radius scale (base 12px), aligned with the web (--radius). */
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Font size scale (pt). Use these tokens instead of arbitrary numbers for consistency.
 *   xs 12 · sm 13 · base 14 · md 15 · lg 16 · xl 18 · xxl 20
 *   title3 22 · title2 26 · title1 28
 */
export const FontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  title3: 22,
  title2: 26,
  title1: 28,
} as const;

/** Standard font weights (literal values so they match the TextStyle type). */
export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Poppins font families per weight. Use these where the global Text patch does
 * NOT reach — e.g. text rendered by React Navigation (drawer labels, native
 * header titles) which is drawn by library components, not our own <Text>.
 */
export const FontFamily = {
  light: 'Poppins-Light',
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semibold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
