/**
 * Drawer navigator — replaces bottom tabs. Mirrors the feature-rich RantAI Agents
 * web sidebar. The native header provides the hamburger button.
 */
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  Bot,
  Clapperboard,
  Folder,
  MessageCircle,
  MessageCirclePlus,
  Search,
  Settings,
  ShoppingCart,
  SquarePen,
  Users,
  Workflow,
} from 'lucide-react-native';

import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AgentsScreen } from '@/screens/agents/agents-screen';
import { HomeScreen } from '@/screens/home/home-screen';
import { KnowledgeScreen } from '@/screens/knowledge/knowledge-screen';
import { MarketplaceScreen } from '@/screens/marketplace/marketplace-screen';
import { NewChatScreen } from '@/screens/chat/new-chat-screen';
import { makePlaceholder } from '@/screens/placeholder';
import { DrawerContent } from './drawer-content';
import { AgentStack } from './agent-stack';
import { ChatStack } from './chat-stack';
import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

const SearchScreen = makePlaceholder('Search', 'Search conversations, agents, and documents.', Search);
const AgentBuilderScreen = makePlaceholder('Agent Builder', 'Configure your AI assistants.', Bot);
const WorkflowsScreen = makePlaceholder('Workflows', 'Build agent automations & pipelines.', Workflow);
const MediaStudioScreen = makePlaceholder('Media Studio', 'Generate images, audio, and video.', Clapperboard);
const SettingsScreen = makePlaceholder('Settings', 'General, credentials, MCP, and more.', Settings);

export function AppDrawer() {
  const theme = useTheme();

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.background, shadowColor: 'transparent' },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: FontFamily.bold },
        drawerActiveTintColor: theme.text,
        drawerInactiveTintColor: theme.textSecondary,
        drawerActiveBackgroundColor: theme.backgroundElement,
        drawerItemStyle: { borderRadius: Radius.lg, marginHorizontal: Spacing.one, marginVertical: Spacing.one },
        drawerLabelStyle: { fontSize: FontSize.lg, fontFamily: FontFamily.medium },
      }}>
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: '',
          // Landing after login, but hidden from the drawer menu list.
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{
          title: 'New Chat',
          // Transit screen (immediately redirected to Home) — no header so the
          // "New Chat" label never briefly shows at the top.
          headerShown: false,
          drawerLabelStyle: { fontSize: FontSize.lg, fontFamily: FontFamily.medium, color: theme.accent },
          drawerIcon: () => <MessageCirclePlus color={theme.accent} size={FontSize.xxl} />,
        }}
      />
      <Drawer.Screen
        name="ChatTab"
        component={ChatStack}
        options={{
          title: 'Chat',
          headerShown: false,
          drawerIcon: ({ color }) => <MessageCircle color={color} size={FontSize.xxl} />,
        }}
        listeners={({ navigation }) => ({
          // Tapping "Chat" always lands on the history list, not whatever thread
          // was last open in the stack (otherwise it re-opens the old thread).
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('ChatTab', { screen: 'ChatList' });
          },
        })}
      />
       
      <Drawer.Screen
        name="AgentBuilder"
        component={AgentStack}
        options={{
          title: 'Agents',
          headerShown: false,
          drawerIcon: ({ color }) => <Bot color={color} size={FontSize.xxl} />,
        }}
        listeners={({ navigation }) => ({
          // Same as Chat: land on the agent list, not a half-open editor.
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('AgentBuilder', { screen: 'AgentList' });
          },
        })}
      />
      {/*
      <Drawer.Screen
        name="Workflows"
        component={WorkflowsScreen}
        options={{ drawerIcon: ({ color }) => <Workflow color={color} size={22} /> }}
      />
      <Drawer.Screen
        name="MediaStudio"
        component={MediaStudioScreen}
        options={{ title: 'Media Studio', drawerIcon: ({ color }) => <Clapperboard color={color} size={22} /> }}
      />
      <Drawer.Screen
        name="Files"
        component={KnowledgeScreen}
        options={{ title: 'Files', drawerIcon: ({ color }) => <Folder color={color} size={22} /> }}
      />
      <Drawer.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ drawerIcon: ({ color }) => <ShoppingCart color={color} size={22} /> }}
      />
      <Drawer.Screen
        name="DigitalEmployees"
        component={AgentsScreen}
        options={{ title: 'Digital Employees', drawerIcon: ({ color }) => <Users color={color} size={22} /> }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', drawerIcon: ({ color }) => <Settings color={color} size={22} /> }}
      /> */}
    </Drawer.Navigator>
  );
}
