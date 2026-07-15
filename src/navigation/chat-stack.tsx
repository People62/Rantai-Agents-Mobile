/**
 * ChatStack — daftar chat → thread. ChatList menampilkan tombol hamburger
 * untuk membuka Drawer; ChatThread memakai tombol back bawaan.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatListScreen } from '@/screens/chat/chat-list-screen';
import { ChatThreadScreen } from '@/screens/chat/chat-thread-screen';
import type { ChatStackParamList, DrawerParamList } from './types';
import { Spacing } from '@/constants/theme';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '700' },
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
