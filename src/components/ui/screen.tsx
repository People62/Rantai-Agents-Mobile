/**
 * Screen — pembungkus dasar tiap layar: latar bertema + safe area.
 */
import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Beri padding horizontal standar. Default true. */
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
};

export function Screen({ children, padded = true, edges = ['top', 'bottom'], style }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: theme.background }, style]}>
      <View style={[styles.inner, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  padded: { paddingHorizontal: Spacing.four },
});
