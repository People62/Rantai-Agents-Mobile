/**
 * WorkflowStack — workflow list → detail → run detail. The list shows the
 * hamburger button to open the Drawer; inner screens use the default back button.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WorkflowDetailScreen } from '@/screens/workflows/workflow-detail-screen';
import { WorkflowListScreen } from '@/screens/workflows/workflow-list-screen';
import { WorkflowRunDetailScreen } from '@/screens/workflows/workflow-run-detail-screen';
import type { DrawerParamList, WorkflowStackParamList } from './types';

const Stack = createNativeStackNavigator<WorkflowStackParamList>();

export function WorkflowStack() {
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
        name="WorkflowList"
        component={WorkflowListScreen}
        options={({ navigation }) => ({
          title: 'Workflows',
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
      <Stack.Screen
        name="WorkflowDetail"
        component={WorkflowDetailScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <Stack.Screen
        name="WorkflowRunDetail"
        component={WorkflowRunDetailScreen}
        options={{ title: 'Run' }}
      />
    </Stack.Navigator>
  );
}
