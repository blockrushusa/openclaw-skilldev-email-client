/**
 * Email Responder Plugin - Type Definitions
 */

export interface EmailAccountConfig {
  enabled?: boolean;
  name?: string;

  // Provider shortcut (gmail, outlook, fastmail, etc.) - auto-fills IMAP/SMTP hosts
  provider?: string;

  // IMAP settings
  imapHost?: string; // required unless provider is set
  imapPort?: number;
  imapUser: string;
  imapPassword: string;
  imapTls?: boolean;

  // SMTP settings
  smtpHost?: string; // required unless provider is set
  smtpPort?: number;
  smtpUser?: string; // defaults to imapUser
  smtpPassword?: string; // defaults to imapPassword
  smtpTls?: boolean;
  smtpStartTls?: boolean;

  // Behavior
  pollIntervalSeconds?: number; // default: 60
  folder?: string; // default: INBOX
  maxRepliesPerSenderPerHour?: number; // default: 5
  systemPrompt?: string;
  replyPrefix?: string; // prefix for reply subjects, default: "Re: "

  // Security & Filtering
  dmPolicy?: "open" | "pairing" | "allowlist";
  filterMode?: "open" | "allowlist" | "blocklist"; // open=respond to all (default), allowlist=only listed, blocklist=all except listed
  allowFrom?: string[]; // emails/patterns to allow (used when filterMode=allowlist)
  blockFrom?: string[]; // emails/patterns to block (used when filterMode=blocklist or always)

  // Signature
  signature?: string;
}

export interface ResolvedEmailAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  email: string;
  config: EmailAccountConfig;
}

export interface ParsedEmail {
  messageId: string;
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  date: Date;
  inReplyTo?: string;
  references?: string[];
  headers: Record<string, string>;
  uid: number;
}

export interface EmailThreadInfo {
  messageId: string;
  inReplyTo?: string;
  references: string[];
}

export interface RateLimitEntry {
  sender: string;
  timestamps: number[];
}

export interface ProcessedMessageStore {
  processedIds: string[];
  rateLimits: Record<string, number[]>;
  lastPollTime?: number;
}

// Auto-reply detection headers
export const AUTO_REPLY_HEADERS = [
  "x-auto-reply",
  "x-autoreply",
  "auto-submitted",
  "x-autorespond",
  "precedence",
];

export const IGNORED_SENDERS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^bounce/i,
  /^notification/i,
];
