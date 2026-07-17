/**
 * RootNavigator — decides what to show based on auth state:
 * loads the saved session → Login (not signed in) or the main app (Drawer).
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { LoginScreen } from '@/screens/auth/login-screen';
import { useAuth } from './auth-context';
import { AppDrawer } from './drawer';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { signedIn, loading } = useAuth();
  const theme = useTheme();

  // Currently loading the saved token from storage.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <Stack.Screen name="Main" component={AppDrawer} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
