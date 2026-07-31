/**
 * NewChat — placeholder route for the drawer's "New Chat" item.
 *
 * The item is intercepted in the drawer (drawerItemPress → navigate to Home),
 * so this screen is never actually focused. It exists only because a
 * Drawer.Screen requires a component. A new conversation is created only when
 * the user sends the first message on Home — never on navigation alone.
 */
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function NewChatScreen() {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
