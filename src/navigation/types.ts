/**
 * Navigation route types (React Navigation).
 */
import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ComposerOptions } from '@/components/chat/composer';

export type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: {
    id: string;
    title: string;
    /** First message from Home; auto-sent once when the thread opens. */
    initialMessage?: string;
    /** Tool selections from the Home composer, used for that first message. */
    initialOptions?: ComposerOptions;
  };
};

export type DrawerParamList = {
  Home: undefined;
  NewChat: undefined;
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  Search: undefined;
  AgentBuilder: undefined;
  Workflows: undefined;
  MediaStudio: undefined;
  Files: undefined;
  Marketplace: undefined;
  DigitalEmployees: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<DrawerParamList>;
};
