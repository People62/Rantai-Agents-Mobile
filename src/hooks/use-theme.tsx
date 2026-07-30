/**
 * Theme mode + palette.
 *
 * `ThemeProvider` holds the user's chosen mode (light / dark / system), persists
 * it to AsyncStorage, and resolves it against the OS scheme. Components keep
 * calling `useTheme()` to get the color palette (unchanged signature); the
 * Settings screen uses `useThemeMode()` to read/change the mode.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
type Scheme = 'light' | 'dark';
type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

const MODE_KEY = 'settings.themeMode';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  scheme: Scheme;
  theme: Palette;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(mode: ThemeMode, system: ReturnType<typeof useColorScheme>): Scheme {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  const scheme = resolve(mode, system);
  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, scheme, theme: Colors[scheme] }),
    [mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active color palette. Falls back to the OS scheme outside the provider. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  if (ctx) return ctx.theme;
  return Colors[system === 'dark' ? 'dark' : 'light'];
}

/** The resolved light/dark scheme (for StatusBar, nav theme, logo, etc.). */
export function useScheme(): Scheme {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  if (ctx) return ctx.scheme;
  return system === 'dark' ? 'dark' : 'light';
}

/** Read + change the theme mode (Settings → Appearance). */
export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return { mode: ctx.mode, setMode: ctx.setMode, scheme: ctx.scheme };
}
