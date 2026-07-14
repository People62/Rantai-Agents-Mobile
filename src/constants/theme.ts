/**
 * Design tokens untuk Rantai-Agent-Mobile.
 *
 * Diadaptasi dari sistem desain web RantAI-Agents (shadcn/ui + Tailwind v4).
 * Nilai oklch web sudah dikonversi ke HEX untuk React Native. Estetika:
 * off-white hangat + aksi hitam monokrom + aksen biru brand (#0071DF).
 *
 * Catatan: key `background`, `text`, `backgroundElement`, `backgroundSelected`,
 * `textSecondary` dipertahankan agar kompatibel dengan komponen lama.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0B0B', // foreground
    textSecondary: '#555555', // muted-foreground
    background: '#F9F8F7', // off-white hangat
    card: '#FFFFFF',
    backgroundElement: '#EFEBE4', // secondary
    backgroundSelected: '#E8E4DD', // muted
    primary: '#0B0B0B', // aksi utama (hitam)
    primaryForeground: '#F9F8F7',
    accent: '#0071DF', // biru brand
    accentForeground: '#FFFFFF',
    border: '#DBD7D0',
    destructive: '#E7000B',
  },
  dark: {
    text: '#FAFAFA',
    textSecondary: '#A1A1A1',
    background: '#0A0A0A',
    card: '#0A0A0A',
    backgroundElement: '#262626',
    backgroundSelected: '#262626',
    primary: '#FAFAFA',
    primaryForeground: '#0A0A0A',
    accent: '#0071DF', // biru tetap dipakai untuk link/highlight
    accentForeground: '#FFFFFF',
    border: '#262626',
    destructive: '#82181A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Skala border-radius (base 12px), diselaraskan dengan web (--radius). */
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
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
