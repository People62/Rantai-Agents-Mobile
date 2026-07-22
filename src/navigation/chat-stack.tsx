/**
 * ChatStack — chat list → thread. ChatList shows the hamburger button to open
 * the Drawer; ChatThread uses the default back button.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatListScreen } from '@/screens/chat/chat-list-screen';
import { ChatThreadScreen } from '@/screens/chat/chat-thread-screen';
import type { ChatStackParamList, DrawerParamList } from './types';
import { FontFamily, Spacing } from '@/constants/theme';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
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
        name="ChatList"
        component={ChatListScreen}
        options={({ navigation }) => ({
          title: 'Chat',
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
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  );
}
