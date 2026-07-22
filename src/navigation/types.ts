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

export type AgentStackParamList = {
  AgentList: undefined;
  /** Agent editor — `id` present = edit an existing agent, absent = create. */
  AgentEditor: { id?: string } | undefined;
};

export type WorkflowStackParamList = {
  WorkflowList: undefined;
  WorkflowDetail: { id: string; name: string };
  WorkflowRunDetail: { workflowId: string; runId: string; name?: string };
};

export type MediaStackParamList = {
  /** Generate screen; `referenceAssetId` pre-adds an image reference. */
  MediaGenerate: { referenceAssetId?: string } | undefined;
  MediaGallery: undefined;
  MediaAsset: { id: string };
};

export type FilesStackParamList = {
  FilesHome: undefined;
  /** Documents list; scoped to a KB group when `groupId` is set. */
  KnowledgeDocs: { groupId?: string; groupName?: string } | undefined;
  KnowledgeDocDetail: { id: string; title: string };
};

export type DrawerParamList = {
  Home: undefined;
  NewChat: undefined;
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  Search: undefined;
  AgentBuilder: NavigatorScreenParams<AgentStackParamList>;
  Workflows: NavigatorScreenParams<WorkflowStackParamList>;
  MediaStudio: NavigatorScreenParams<MediaStackParamList>;
  Files: NavigatorScreenParams<FilesStackParamList>;
  Marketplace: undefined;
  DigitalEmployees: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<DrawerParamList>;
};
