/**
 * SettingsStack — Settings home → Organization settings. SettingsHome shows the
 * hamburger to open the Drawer; OrganizationSettings uses the default back button.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiKeysScreen } from '@/screens/settings/api-keys-screen';
import { BillingScreen } from '@/screens/settings/billing-screen';
import { CredentialsScreen } from '@/screens/settings/credentials-screen';
import { McpServersScreen } from '@/screens/settings/mcp-servers-screen';
import { MemoryScreen } from '@/screens/settings/memory-screen';
import { OrganizationScreen } from '@/screens/settings/organization-screen';
import { SettingsScreen } from '@/screens/settings/settings-screen';
import { SkillsScreen } from '@/screens/settings/skills-screen';
import { ToolsScreen } from '@/screens/settings/tools-screen';
import type { DrawerParamList, SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
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
        name="SettingsHome"
        component={SettingsScreen}
        options={({ navigation }) => ({
          title: 'Settings',
          headerLeft: () => (
            <Pressable
              onPress={() =>
                navigation.getParent<DrawerNavigationProp<DrawerParamList>>()?.openDrawer()
              }
              hitSlop={8}
              style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
              <Menu color={theme.text} size={24} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="Billing" component={BillingScreen} options={{ title: 'Billing' }} />
      <Stack.Screen
        name="OrganizationSettings"
        component={OrganizationScreen}
        options={{ title: 'Organization' }}
      />
      <Stack.Screen name="Tools" component={ToolsScreen} options={{ title: 'Tools' }} />
      <Stack.Screen name="Skills" component={SkillsScreen} options={{ title: 'Skills' }} />
      <Stack.Screen
        name="Credentials"
        component={CredentialsScreen}
        options={{ title: 'Credentials' }}
      />
      <Stack.Screen
        name="McpServers"
        component={McpServersScreen}
        options={{ title: 'MCP Servers' }}
      />
      <Stack.Screen
        name="Memory"
        component={MemoryScreen}
        options={{ title: 'Memory' }}
      />
      <Stack.Screen
        name="ApiKeys"
        component={ApiKeysScreen}
        options={{ title: 'Agent API Keys' }}
      />
    </Stack.Navigator>
  );
}
