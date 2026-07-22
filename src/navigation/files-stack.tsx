/**
 * FilesStack — knowledge bases (FilesHome) → documents list → document detail.
 * FilesHome shows the hamburger to open the Drawer.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DocumentDetailScreen } from '@/screens/files/document-detail-screen';
import { DocumentsScreen } from '@/screens/files/documents-screen';
import { FilesHomeScreen } from '@/screens/files/files-home-screen';
import type { DrawerParamList, FilesStackParamList } from './types';

const Stack = createNativeStackNavigator<FilesStackParamList>();

export function FilesStack() {
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
        name="FilesHome"
        component={FilesHomeScreen}
        options={({ navigation }) => ({
          title: 'Files',
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
        name="KnowledgeDocs"
        component={DocumentsScreen}
        options={({ route }) => ({ title: route.params?.groupName ?? 'All Documents' })}
      />
      <Stack.Screen
        name="KnowledgeDocDetail"
        component={DocumentDetailScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  );
}
