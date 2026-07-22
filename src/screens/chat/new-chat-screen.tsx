/**
 * NewChat — the "New Chat" drawer item that redirects to the compose page (Home).
 *
 * Important: a new conversation is created ONLY when the user sends the first
 * message (on Home), NOT when the screen opens. This prevents empty sessions
 * from being created automatically just due to focus (e.g. when the app is
 * reopened or the user navigates back).
 */
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { DrawerParamList } from '@/navigation/types';

type Props = DrawerScreenProps<DrawerParamList, 'NewChat'>;

export function NewChatScreen({ navigation }: Props) {
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      navigation.navigate('Home');
    }, [navigation]),
  );

  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
