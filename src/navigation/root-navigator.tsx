/**
 * RootNavigator — memilih antara Login (belum masuk) dan aplikasi utama (Tabs).
 * Status auth dikelola AuthProvider (UI-only, tanpa backend).
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '@/screens/auth/login-screen';
import { useAuth } from './auth-context';
import { Tabs } from './tabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { signedIn } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* {signedIn ? (
        <Stack.Screen name="Main" component={Tabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
        )} */}
      {/* <Stack.Screen name="Main" component={Tabs} /> */}
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
