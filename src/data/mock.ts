/**
 * Data contoh (dummy) untuk fase desain UI — TIDAK terhubung backend.
 * Ganti dengan data asli dari src/lib/api.ts saat integrasi nanti.
 */

export type Conversation = {
  id: string;
  title: string;
  lastMessage: string;
  time: string;
  unread?: number;
};

export const conversations: Conversation[] = [
  { id: '1', title: 'Sales Assistant', lastMessage: 'Tentu, ini ringkasan penjualan bulan ini…', time: '09:24', unread: 2 },
  { id: '2', title: 'Support Bot', lastMessage: 'Tiket #4821 sudah ditutup.', time: 'Kemarin' },
  { id: '3', title: 'Riset Pasar', lastMessage: 'Saya menemukan 3 tren utama…', time: 'Kemarin' },
  { id: '4', title: 'HR Onboarding', lastMessage: 'Selamat datang! Berikut langkah pertama…', time: 'Sen' },
];

export type MarketItem = {
  id: string;
  name: string;
  description: string;
  category: 'Assistant' | 'Skill' | 'Tool';
  installs: string;
};

export const marketItems: MarketItem[] = [
  { id: 'm1', name: 'Customer Support Pro', description: 'Agen dukungan pelanggan multibahasa.', category: 'Assistant', installs: '12K' },
  { id: 'm2', name: 'Web Search', description: 'Pencarian web real-time untuk agen.', category: 'Tool', installs: '48K' },
  { id: 'm3', name: 'PDF Reader', description: 'Ekstrak & tanya-jawab dokumen PDF.', category: 'Skill', installs: '31K' },
  { id: 'm4', name: 'Sales Analyst', description: 'Analisis data penjualan otomatis.', category: 'Assistant', installs: '8K' },
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
  { id: 'f1', name: 'Panduan Produk 2026.pdf', size: '2.4 MB', type: 'PDF' },
  { id: 'f2', name: 'FAQ Pelanggan.docx', size: '640 KB', type: 'DOCX' },
  { id: 'f3', name: 'Data Penjualan Q2.csv', size: '1.1 MB', type: 'CSV' },
];
