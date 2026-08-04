/**
 * AdminStack — platform admin console: dashboard → channel config. Only mounted
 * for users whose platform role is ADMIN (gated in the drawer).
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AdminChannelScreen } from '@/screens/admin/admin-channel-screen';
import { AdminDashboardScreen } from '@/screens/admin/admin-dashboard-screen';
import type { AdminStackParamList, DrawerParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: FontFamily.bold },
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={({ navigation }) => ({
          title: 'Admin',
          headerLeft: () => (
            <Pressable
              onPress={() =>
                navigation.getParent<DrawerNavigationProp<DrawerParamList>>()?.openDrawer()
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
              <Menu color={theme.text} size={24} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="AdminChannel" component={AdminChannelScreen} options={{ title: 'Channel' }} />
    </Stack.Navigator>
  );
}
