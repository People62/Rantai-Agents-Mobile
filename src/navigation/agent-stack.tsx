/**
 * AgentStack — agent list → agent editor. AgentList shows the hamburger button
 * to open the Drawer plus a "+" button to create; AgentEditor uses the default
 * back button.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu, Plus } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AgentEditorScreen } from '@/screens/agents/agent-editor-screen';
import { AgentListScreen } from '@/screens/agents/agent-list-screen';
import type { AgentStackParamList, DrawerParamList } from './types';

const Stack = createNativeStackNavigator<AgentStackParamList>();

export function AgentStack() {
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
        name="AgentList"
        component={AgentListScreen}
        options={({ navigation }) => ({
          title: 'Agents',
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
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate('AgentEditor')}
              hitSlop={8}
              style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
              <Plus color={theme.accent} size={24} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="AgentEditor"
        component={AgentEditorScreen}
        options={({ route }) => ({
          title: route.params?.id ? 'Edit Agent' : 'New Agent',
        })}
      />
    </Stack.Navigator>
  );
}
