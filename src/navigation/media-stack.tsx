/**
 * MediaStack — Generate (root) → Gallery → Asset detail. Generate shows the
 * hamburger (open Drawer) plus an "Images" button to the library.
 */
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Images, Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MediaAssetScreen } from '@/screens/media/media-asset-screen';
import { MediaGalleryScreen } from '@/screens/media/media-gallery-screen';
import { MediaGenerateScreen } from '@/screens/media/media-generate-screen';
import type { DrawerParamList, MediaStackParamList } from './types';

const Stack = createNativeStackNavigator<MediaStackParamList>();

export function MediaStack() {
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
        name="MediaGenerate"
        component={MediaGenerateScreen}
        options={({ navigation }) => ({
          title: 'Media Studio',
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
              onPress={() => navigation.navigate('MediaGallery')}
              hitSlop={8}
              style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
              <Images color={theme.text} size={22} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="MediaGallery"
        component={MediaGalleryScreen}
        options={{ title: 'Library' }}
      />
      <Stack.Screen
        name="MediaAsset"
        component={MediaAssetScreen}
        options={{ title: 'Asset' }}
      />
    </Stack.Navigator>
  );
}
