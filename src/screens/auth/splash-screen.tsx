/**
 * SplashScreen — branded screen shown while the saved session is restored at
 * startup. The logo sits at the exact screen centre so it lines up with the
 * login screen's intro animation (logo rises from centre → header).
 */
import { StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/ui';
import { FontFamily, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SplashScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Logo width={120} />
      <Text style={[styles.brand, { color: theme.text }]}>RantAI Agents</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: {
    position: 'absolute',
    top: '57%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: FontSize.title3,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.3,
  },
});
