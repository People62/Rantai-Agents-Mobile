/**
 * Shared metadata for the admin communication channels — display labels, emoji,
 * and the per-channel credential fields the detail form renders. Mirrors the web
 * `channelMeta` so the mobile form stays in sync with the backend config shape.
 */
export const CHANNEL_LABEL: Record<string, string> = {
  PORTAL: 'Agent Portal',
  SALESFORCE: 'Salesforce',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
};

export const CHANNEL_EMOJI: Record<string, string> = {
  PORTAL: '🌐',
  SALESFORCE: '☁️',
  WHATSAPP: '📱',
  EMAIL: '📧',
};

export type ChannelField = {
  key: string;
  label: string;
  secret?: boolean;
  keyboard?: 'default' | 'email-address' | 'numeric';
};

/** Credential fields per channel. PORTAL has none (it's the built-in web chat). */
export const CHANNEL_FIELDS: Record<string, ChannelField[]> = {
  PORTAL: [],
  SALESFORCE: [
    { key: 'orgId', label: 'Organization ID' },
    { key: 'deploymentName', label: 'Deployment Name' },
    { key: 'siteUrl', label: 'Site URL' },
    { key: 'scrt2Url', label: 'SCRT2 URL' },
  ],
  WHATSAPP: [
    { key: 'phoneNumberId', label: 'Phone Number ID' },
    { key: 'accessToken', label: 'Access Token', secret: true },
    { key: 'agentPhoneNumber', label: 'Agent Phone Number' },
    { key: 'templateName', label: 'Template Name' },
  ],
  EMAIL: [
    { key: 'smtpHost', label: 'SMTP Host' },
    { key: 'smtpPort', label: 'SMTP Port', keyboard: 'numeric' },
    { key: 'smtpUser', label: 'SMTP User' },
    { key: 'smtpPass', label: 'SMTP Password', secret: true },
    { key: 'fromEmail', label: 'From Email', keyboard: 'email-address' },
    { key: 'fromName', label: 'From Name' },
  ],
};

export const channelLabel = (c: string) => CHANNEL_LABEL[c] ?? c;
export const channelEmoji = (c: string) => CHANNEL_EMOJI[c] ?? '💬';
