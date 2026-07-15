/**
 * Drawer navigator — menggantikan bottom tabs. Meniru sidebar web RantAI Agents
 * yang punya banyak fitur. Header native menyediakan tombol hamburger.
 */
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  Bot,
  Clapperboard,
  Folder,
  MessageCircle,
  Search,
  Settings,
  ShoppingCart,
  Users,
  Workflow,
} from 'lucide-react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AgentsScreen } from '@/screens/agents/agents-screen';
import { KnowledgeScreen } from '@/screens/knowledge/knowledge-screen';
import { MarketplaceScreen } from '@/screens/marketplace/marketplace-screen';
import { makePlaceholder } from '@/screens/placeholder';
import { DrawerContent } from './drawer-content';
import { ChatStack } from './chat-stack';
import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

const SearchScreen = makePlaceholder('Search', 'Cari percakapan, agen, dan dokumen.', Search);
const AgentBuilderScreen = makePlaceholder('Agent Builder', 'Konfigurasi asisten AI Anda.', Bot);
const WorkflowsScreen = makePlaceholder('Workflows', 'Rangkai otomasi & pipeline agen.', Workflow);
const MediaStudioScreen = makePlaceholder('Media Studio', 'Hasilkan gambar, audio, dan video.', Clapperboard);
const SettingsScreen = makePlaceholder('Pengaturan', 'Umum, kredensial, MCP, dan lainnya.', Settings);

export function AppDrawer() {
  const theme = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.background, shadowColor: 'transparent' },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: FontWeight.bold },
        drawerActiveTintColor: theme.text,
        drawerInactiveTintColor: theme.textSecondary,
        drawerActiveBackgroundColor: theme.backgroundElement,
        drawerItemStyle: { borderRadius: Radius.lg, marginHorizontal: Spacing.one, marginVertical: Spacing.one },
        drawerLabelStyle: { fontSize: FontSize.lg },
      }}>
      <Drawer.Screen
        name="ChatTab"
        component={ChatStack}
        options={{
          title: 'Chat',
          headerShown: false,
          drawerIcon: ({ color }) => <MessageCircle color={color} size={FontSize.xxl} />,
        }}
      />
       
      <Drawer.Screen
        name="AgentBuilder"
        component={AgentBuilderScreen}
        options={{ 
          title: 'Agent Builder', 
          headerShown: false,
          drawerIcon: ({ color }) => <Bot color={color} size={FontSize.xxl} /> }}
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
        options={{ title: 'Pengaturan', drawerIcon: ({ color }) => <Settings color={color} size={22} /> }}
      /> */}
    </Drawer.Navigator>
  );
}
