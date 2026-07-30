/**
 * Root aplikasi (bare React Native).
 *
 * Design system + navigation shell:
 * - ThemeProvider (mode light/dark/system, dipersist) → AppShell
 * - AuthProvider (UI-only) → RootNavigator (Login / Main tabs)
 * - Palet warna dari src/constants/theme.ts
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ThemeProvider, useScheme } from '@/hooks/use-theme';
import { AuthProvider } from '@/navigation/auth-context';
import { RootNavigator } from '@/navigation/root-navigator';

function AppShell() {
  const scheme = useScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const navTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <NavigationContainer
        theme={{
          ...navTheme,
          colors: {
            ...navTheme.colors,
            background: colors.background,
            card: colors.background,
            text: colors.text,
            border: colors.border,
            primary: colors.accent,
          },
        }}>
        <AuthProvider>
          <BottomSheetModalProvider>
            <RootNavigator />
          </BottomSheetModalProvider>
        </AuthProvider>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
