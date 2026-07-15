/**
 * RootNavigator — menentukan tampilan berdasarkan status auth:
 * memuat sesi tersimpan → Login (belum masuk) atau aplikasi utama (Drawer).
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

  // Sedang memuat token tersimpan dari storage.
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
