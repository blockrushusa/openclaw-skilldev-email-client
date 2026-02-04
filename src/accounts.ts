/**
 * Email Account Resolution
 */

import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { ResolvedEmailAccount, EmailAccountConfig } from "./types.js";

const DEFAULT_ACCOUNT_ID = "default";

/**
 * Provider presets - just set `provider: gmail` instead of IMAP/SMTP hosts
 */
const PROVIDER_PRESETS: Record<string, { imapHost: string; smtpHost: string; imapPort?: number; smtpPort?: number }> = {
  gmail: { imapHost: "imap.gmail.com", smtpHost: "smtp.gmail.com" },
  googlemail: { imapHost: "imap.gmail.com", smtpHost: "smtp.gmail.com" },
  outlook: { imapHost: "outlook.office365.com", smtpHost: "smtp.office365.com" },
  office365: { imapHost: "outlook.office365.com", smtpHost: "smtp.office365.com" },
  hotmail: { imapHost: "outlook.office365.com", smtpHost: "smtp.office365.com" },
  live: { imapHost: "outlook.office365.com", smtpHost: "smtp.office365.com" },
  fastmail: { imapHost: "imap.fastmail.com", smtpHost: "smtp.fastmail.com" },
  icloud: { imapHost: "imap.mail.me.com", smtpHost: "smtp.mail.me.com" },
  yahoo: { imapHost: "imap.mail.yahoo.com", smtpHost: "smtp.mail.yahoo.com" },
  aol: { imapHost: "imap.aol.com", smtpHost: "smtp.aol.com" },
  zoho: { imapHost: "imap.zoho.com", smtpHost: "smtp.zoho.com" },
  protonmail: { imapHost: "127.0.0.1", smtpHost: "127.0.0.1", imapPort: 1143, smtpPort: 1025 }, // requires bridge
};

/**
 * Apply provider preset to config (fills in IMAP/SMTP hosts if missing)
 */
function applyProviderPreset(config: EmailAccountConfig): EmailAccountConfig {
  if (!config.provider) return config;
  
  const preset = PROVIDER_PRESETS[config.provider.toLowerCase()];
  if (!preset) return config;

  return {
    ...config,
    imapHost: config.imapHost || preset.imapHost,
    smtpHost: config.smtpHost || preset.smtpHost,
    imapPort: config.imapPort || preset.imapPort,
    smtpPort: config.smtpPort || preset.smtpPort,
  };
}

interface EmailChannelConfig {
  enabled?: boolean;
  accounts?: Record<string, EmailAccountConfig>;
  // Top-level fields for single-account setups
  name?: string;
  provider?: string; // gmail, outlook, fastmail, etc.
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPassword?: string;
  imapTls?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpTls?: boolean;
  smtpStartTls?: boolean;
  pollIntervalSeconds?: number;
  folder?: string;
  maxRepliesPerSenderPerHour?: number;
  systemPrompt?: string;
  replyPrefix?: string;
  dmPolicy?: "open" | "pairing" | "allowlist";
  filterMode?: "open" | "allowlist" | "blocklist";
  allowFrom?: string[];
  blockFrom?: string[];
  signature?: string;
}

export function listEmailAccountIds(cfg: ClawdbotConfig): string[] {
  const channelConfig = (cfg.channels as Record<string, unknown>)?.email as EmailChannelConfig | undefined;
  if (!channelConfig) return [];

  const accountIds: string[] = [];

  // Check for accounts object
  if (channelConfig.accounts) {
    accountIds.push(...Object.keys(channelConfig.accounts));
  }

  // Check for top-level config (implies default account)
  if ((channelConfig.imapHost || channelConfig.provider) && channelConfig.imapUser) {
    if (!accountIds.includes(DEFAULT_ACCOUNT_ID)) {
      accountIds.push(DEFAULT_ACCOUNT_ID);
    }
  }

  return accountIds;
}

export function resolveEmailAccount(opts: {
  cfg: ClawdbotConfig;
  accountId?: string;
}): ResolvedEmailAccount {
  const { cfg, accountId = DEFAULT_ACCOUNT_ID } = opts;
  const channelConfig = (cfg.channels as Record<string, unknown>)?.email as EmailChannelConfig | undefined;

  if (!channelConfig) {
    return {
      accountId,
      enabled: false,
      configured: false,
      email: "",
      config: {} as EmailAccountConfig,
    };
  }

  // Try to get account-specific config first
  let accountConfig: EmailAccountConfig | undefined;
  let accountEnabled: boolean | undefined;

  if (channelConfig.accounts?.[accountId]) {
    accountConfig = applyProviderPreset(channelConfig.accounts[accountId]);
    accountEnabled = accountConfig.enabled;
  } else if (accountId === DEFAULT_ACCOUNT_ID && (channelConfig.imapHost || channelConfig.provider)) {
    // Use top-level config as default account
    accountConfig = applyProviderPreset({
      name: channelConfig.name,
      provider: channelConfig.provider,
      imapHost: channelConfig.imapHost,
      imapPort: channelConfig.imapPort,
      imapUser: channelConfig.imapUser!,
      imapPassword: channelConfig.imapPassword!,
      imapTls: channelConfig.imapTls,
      smtpHost: channelConfig.smtpHost,
      smtpPort: channelConfig.smtpPort,
      smtpUser: channelConfig.smtpUser,
      smtpPassword: channelConfig.smtpPassword,
      smtpTls: channelConfig.smtpTls,
      smtpStartTls: channelConfig.smtpStartTls,
      pollIntervalSeconds: channelConfig.pollIntervalSeconds,
      folder: channelConfig.folder,
      maxRepliesPerSenderPerHour: channelConfig.maxRepliesPerSenderPerHour,
      systemPrompt: channelConfig.systemPrompt,
      replyPrefix: channelConfig.replyPrefix,
      dmPolicy: channelConfig.dmPolicy,
      filterMode: channelConfig.filterMode,
      allowFrom: channelConfig.allowFrom,
      blockFrom: channelConfig.blockFrom,
      signature: channelConfig.signature,
    });
    accountEnabled = channelConfig.enabled;
  }

  if (!accountConfig) {
    return {
      accountId,
      enabled: false,
      configured: false,
      email: "",
      config: {} as EmailAccountConfig,
    };
  }

  const configured = Boolean(
    accountConfig.imapHost &&
    accountConfig.imapUser &&
    accountConfig.imapPassword &&
    accountConfig.smtpHost
  );

  const enabled = accountEnabled !== false && configured && channelConfig.enabled !== false;

  return {
    accountId,
    name: accountConfig.name,
    enabled,
    configured,
    email: accountConfig.imapUser || "",
    config: accountConfig,
  };
}

export function resolveDefaultEmailAccountId(cfg: ClawdbotConfig): string {
  const accountIds = listEmailAccountIds(cfg);

  // Prefer explicitly named default
  if (accountIds.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }

  // Fall back to first account
  return accountIds[0] || DEFAULT_ACCOUNT_ID;
}

export function normalizeEmailAddress(email: string): string {
  return email.toLowerCase().trim();
}

export { DEFAULT_ACCOUNT_ID };
