/**
 * Tipe rute navigasi (React Navigation).
 */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { id: string; title: string };
};

export type TabParamList = {
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  Marketplace: undefined;
  Agents: undefined;
  Knowledge: undefined;
  More: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParamList>;
};
