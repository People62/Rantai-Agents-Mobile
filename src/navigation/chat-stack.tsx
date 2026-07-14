/**
 * ChatStack — contoh nested stack: daftar chat → thread.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatListScreen } from '@/screens/chat/chat-list-screen';
import { ChatThreadScreen } from '@/screens/chat/chat-thread-screen';
import type { ChatStackParamList } from './types';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  );
}
