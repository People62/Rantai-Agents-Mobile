/**
 * Tipe rute navigasi (React Navigation).
 */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { id: string; title: string };
};

export type DrawerParamList = {
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
