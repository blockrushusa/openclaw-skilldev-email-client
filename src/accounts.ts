/**
 * Email Account Resolution
 */

import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { ResolvedEmailAccount, EmailAccountConfig } from "./types.js";

const DEFAULT_ACCOUNT_ID = "default";

interface EmailChannelConfig {
  enabled?: boolean;
  accounts?: Record<string, EmailAccountConfig>;
  // Top-level fields for single-account setups
  name?: string;
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
  if (channelConfig.imapHost && channelConfig.imapUser) {
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
    accountConfig = channelConfig.accounts[accountId];
    accountEnabled = accountConfig.enabled;
  } else if (accountId === DEFAULT_ACCOUNT_ID && channelConfig.imapHost) {
    // Use top-level config as default account
    accountConfig = {
      name: channelConfig.name,
      imapHost: channelConfig.imapHost,
      imapPort: channelConfig.imapPort,
      imapUser: channelConfig.imapUser!,
      imapPassword: channelConfig.imapPassword!,
      imapTls: channelConfig.imapTls,
      smtpHost: channelConfig.smtpHost!,
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
    };
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
