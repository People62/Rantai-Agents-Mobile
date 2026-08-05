/**
 * AdminStack — platform admin console. Only mounted for users whose platform
 * role is ADMIN (gated in the drawer). Mirrors the web `/dashboard/admin`:
 * a single shell with three segmented tabs (Users · Models · Knowledge), plus
 * a pushed user-detail screen.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AdminHomeScreen } from '@/screens/admin/admin-home-screen';
import { AdminUserDetailScreen } from '@/screens/admin/admin-user-detail-screen';
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
        name="AdminHome"
        component={AdminHomeScreen}
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
      <Stack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{ title: 'User' }}
      />
    </Stack.Navigator>
  );
}
