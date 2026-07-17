/**
 * Sample (dummy) data for the UI design phase — NOT connected to the backend.
 * Replace with real data from src/lib/api.ts during integration later.
 */

export type Conversation = {
  id: string;
  title: string;
  lastMessage: string;
  time: string;
  unread?: number;
};

export const conversations: Conversation[] = [
  { id: '1', title: 'Sales Assistant', lastMessage: 'Sure, here is this month\'s sales summary…', time: '09:24', unread: 2 },
  { id: '2', title: 'Support Bot', lastMessage: 'Ticket #4821 has been closed.', time: 'Yesterday' },
  { id: '3', title: 'Market Research', lastMessage: 'I found 3 major trends…', time: 'Yesterday' },
  { id: '4', title: 'HR Onboarding', lastMessage: 'Welcome! Here are the first steps…', time: 'Mon' },
];

export type MarketItem = {
  id: string;
  name: string;
  description: string;
  category: 'Assistant' | 'Skill' | 'Tool';
  installs: string;
};

export const marketItems: MarketItem[] = [
  { id: 'm1', name: 'Customer Support Pro', description: 'Multilingual customer support agent.', category: 'Assistant', installs: '12K' },
  { id: 'm2', name: 'Web Search', description: 'Real-time web search for agents.', category: 'Tool', installs: '48K' },
  { id: 'm3', name: 'PDF Reader', description: 'Extract & answer questions from PDF documents.', category: 'Skill', installs: '31K' },
  { id: 'm4', name: 'Sales Analyst', description: 'Automated sales data analysis.', category: 'Assistant', installs: '8K' },
];

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle';
};

export const agents: Agent[] = [
  { id: 'a1', name: 'Aria', role: 'Sales Digital Employee', status: 'active' },
  { id: 'a2', name: 'Beno', role: 'Support Operator', status: 'idle' },
  { id: 'a3', name: 'Cira', role: 'Research Analyst', status: 'active' },
];

export type KnowledgeFile = {
  id: string;
  name: string;
  size: string;
  type: string;
};

export const knowledgeFiles: KnowledgeFile[] = [
  { id: 'f1', name: 'Product Guide 2026.pdf', size: '2.4 MB', type: 'PDF' },
  { id: 'f2', name: 'Customer FAQ.docx', size: '640 KB', type: 'DOCX' },
  { id: 'f3', name: 'Q2 Sales Data.csv', size: '1.1 MB', type: 'CSV' },
];
