/**
 * Bottom tabs utama (5 seksi). Ikon sementara memakai emoji;
 * akan diganti lucide-react-native pada langkah native berikutnya.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { AgentsScreen } from '@/screens/agents/agents-screen';
import { KnowledgeScreen } from '@/screens/knowledge/knowledge-screen';
import { MarketplaceScreen } from '@/screens/marketplace/marketplace-screen';
import { MoreScreen } from '@/screens/more/more-screen';
import { ChatStack } from './chat-stack';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const icon = (emoji: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 20, color }}>{emoji}</Text>;

export function Tabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
      }}>
      <Tab.Screen name="ChatTab" component={ChatStack} options={{ title: 'Chat', tabBarIcon: icon('💬') }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarIcon: icon('🧩') }} />
      <Tab.Screen name="Agents" component={AgentsScreen} options={{ tabBarIcon: icon('🤖') }} />
      <Tab.Screen name="Knowledge" component={KnowledgeScreen} options={{ tabBarIcon: icon('📁') }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ title: 'Lainnya', tabBarIcon: icon('⋯') }} />
    </Tab.Navigator>
  );
}
