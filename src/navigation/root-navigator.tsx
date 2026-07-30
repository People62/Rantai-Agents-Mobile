/**
 * RootNavigator — decides what to show based on auth state:
 * loads the saved session → Login (not signed in) or the main app (Drawer).
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '@/screens/auth/login-screen';
import { SplashScreen } from '@/screens/auth/splash-screen';
import { useAuth } from './auth-context';
import { AppDrawer } from './drawer';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { signedIn, loading } = useAuth();

  // Restoring the saved session from storage — show the branded splash.
  if (loading) {
    return <SplashScreen />;
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
