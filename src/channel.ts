/**
 * Email Channel Plugin Implementation
 */

import type { ChannelAccountSnapshot, ChannelPlugin, ClawdbotConfig } from "clawdbot/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  setAccountEnabledInConfigSection,
  deleteAccountFromConfigSection,
  applyAccountNameToChannelSection,
  PAIRING_APPROVED_MESSAGE,
} from "clawdbot/plugin-sdk";

import {
  listEmailAccountIds,
  resolveEmailAccount,
  resolveDefaultEmailAccountId,
  normalizeEmailAddress,
  type ResolvedEmailAccount,
} from "./accounts.js";
import { EmailConfigSchema } from "./config-schema.js";
import { monitorEmailProvider, setEmailRuntime } from "./monitor.js";
import { getSmtpTransporter, sendEmail, buildReplySubject, buildThreadInfo } from "./smtp.js";

const meta = {
  id: "email",
  label: "Email",
  selectionLabel: "Email (IMAP/SMTP)",
  detailLabel: "Email",
  docsPath: "/channels/email",
  docsLabel: "email",
  blurb: "Monitor IMAP inbox and send AI-powered replies via SMTP.",
  systemImage: "envelope",
  aliases: ["mail", "imap"],
  order: 80,
};

export const emailPlugin: ChannelPlugin<ResolvedEmailAccount> = {
  id: "email",
  meta,
  capabilities: {
    chatTypes: ["direct"],
    media: false, // Email attachments not yet supported
    reactions: false,
    edit: false,
    unsend: false,
    reply: true,
    effects: false,
    groupManagement: false,
  },
  threading: {
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || undefined,
      currentThreadTs: context.ReplyToId,
      hasRepliedRef,
    }),
  },
  reload: { configPrefixes: ["channels.email"] },
  configSchema: EmailConfigSchema,
  config: {
    listAccountIds: (cfg) => listEmailAccountIds(cfg as ClawdbotConfig),
    resolveAccount: (cfg, accountId) =>
      resolveEmailAccount({ cfg: cfg as ClawdbotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultEmailAccountId(cfg as ClawdbotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as ClawdbotConfig,
        sectionKey: "email",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as ClawdbotConfig,
        sectionKey: "email",
        accountId,
        clearBaseFields: [
          "imapHost", "imapPort", "imapUser", "imapPassword", "imapTls",
          "smtpHost", "smtpPort", "smtpUser", "smtpPassword", "smtpTls", "smtpStartTls",
          "pollIntervalSeconds", "folder", "maxRepliesPerSenderPerHour",
          "systemPrompt", "replyPrefix", "dmPolicy", "allowFrom", "signature", "name",
        ],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      email: account.email,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveEmailAccount({ cfg: cfg as ClawdbotConfig, accountId }).config.allowFrom ?? []).map(
        (entry) => String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => normalizeEmailAddress(entry.replace(/^email:/i, ""))),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        (cfg as ClawdbotConfig).channels?.email?.accounts?.[resolvedAccountId],
      );
      const basePath = useAccountPath
        ? `channels.email.accounts.${resolvedAccountId}.`
        : "channels.email.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("email"),
        normalizeEntry: (raw) => normalizeEmailAddress(raw.replace(/^email:/i, "")),
      };
    },
  },
  messaging: {
    normalizeTarget: (target) => normalizeEmailAddress(target),
    targetResolver: {
      looksLikeId: (target) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target),
      hint: "<email@example.com>",
    },
    formatTargetDisplay: ({ target, display }) => {
      return display?.trim() || target?.trim() || "";
    },
  },
  setup: {
    resolveAccountId: ({ accountId }) =>
      accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg: cfg as ClawdbotConfig,
        channelKey: "email",
        accountId,
        name,
      }),
    validateInput: ({ input }) => {
      if (!input.imapHost) return "Email requires --imap-host.";
      if (!input.imapUser) return "Email requires --imap-user (your email address).";
      if (!input.imapPassword) return "Email requires --imap-password (or app password).";
      if (!input.smtpHost) return "Email requires --smtp-host.";
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg: cfg as ClawdbotConfig,
        channelKey: "email",
        accountId,
        name: input.name,
      });

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...namedConfig,
          channels: {
            ...namedConfig.channels,
            email: {
              ...namedConfig.channels?.email,
              enabled: true,
              ...(input.imapHost ? { imapHost: input.imapHost } : {}),
              ...(input.imapPort ? { imapPort: input.imapPort } : {}),
              ...(input.imapUser ? { imapUser: input.imapUser } : {}),
              ...(input.imapPassword ? { imapPassword: input.imapPassword } : {}),
              ...(input.smtpHost ? { smtpHost: input.smtpHost } : {}),
              ...(input.smtpPort ? { smtpPort: input.smtpPort } : {}),
              ...(input.smtpUser ? { smtpUser: input.smtpUser } : {}),
              ...(input.smtpPassword ? { smtpPassword: input.smtpPassword } : {}),
            },
          },
        } as ClawdbotConfig;
      }

      return {
        ...namedConfig,
        channels: {
          ...namedConfig.channels,
          email: {
            ...namedConfig.channels?.email,
            enabled: true,
            accounts: {
              ...(namedConfig.channels?.email?.accounts ?? {}),
              [accountId]: {
                ...(namedConfig.channels?.email?.accounts?.[accountId] ?? {}),
                enabled: true,
                ...(input.imapHost ? { imapHost: input.imapHost } : {}),
                ...(input.imapPort ? { imapPort: input.imapPort } : {}),
                ...(input.imapUser ? { imapUser: input.imapUser } : {}),
                ...(input.imapPassword ? { imapPassword: input.imapPassword } : {}),
                ...(input.smtpHost ? { smtpHost: input.smtpHost } : {}),
                ...(input.smtpPort ? { smtpPort: input.smtpPort } : {}),
                ...(input.smtpUser ? { smtpUser: input.smtpUser } : {}),
                ...(input.smtpPassword ? { smtpPassword: input.smtpPassword } : {}),
              },
            },
          },
        },
      } as ClawdbotConfig;
    },
  },
  pairing: {
    idLabel: "emailSenderId",
    normalizeAllowEntry: (entry) => normalizeEmailAddress(entry.replace(/^email:/i, "")),
    notifyApproval: async ({ cfg, id }) => {
      // Send approval notification email
      const account = resolveEmailAccount({ cfg: cfg as ClawdbotConfig });
      if (!account.configured) return;

      const transporter = getSmtpTransporter({
        host: account.config.smtpHost,
        port: account.config.smtpPort ?? 587,
        user: account.config.smtpUser ?? account.config.imapUser,
        password: account.config.smtpPassword ?? account.config.imapPassword,
        tls: account.config.smtpTls ?? false,
        startTls: account.config.smtpStartTls ?? true,
      });

      await sendEmail({
        transporter,
        from: account.email,
        to: id,
        subject: "Clawdbot Pairing Approved",
        text: PAIRING_APPROVED_MESSAGE,
      });
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 50000, // Emails can be long
    resolveTarget: ({ to }) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: new Error("Sending email requires --to <email@example.com>"),
        };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return {
          ok: false,
          error: new Error(`Invalid email address: ${trimmed}`),
        };
      }
      return { ok: true, to: trimmed };
    },
    sendText: async ({ cfg, to, text, accountId, replyToId }) => {
      const account = resolveEmailAccount({
        cfg: cfg as ClawdbotConfig,
        accountId: accountId ?? undefined,
      });

      if (!account.configured) {
        return { ok: false, error: "Email account not configured" };
      }

      const transporter = getSmtpTransporter({
        host: account.config.smtpHost,
        port: account.config.smtpPort ?? 587,
        user: account.config.smtpUser ?? account.config.imapUser,
        password: account.config.smtpPassword ?? account.config.imapPassword,
        tls: account.config.smtpTls ?? false,
        startTls: account.config.smtpStartTls ?? true,
      });

      // Build thread info if replying
      let threadInfo;
      if (replyToId) {
        threadInfo = buildThreadInfo(replyToId);
      }

      const result = await sendEmail({
        transporter,
        from: account.email,
        to,
        subject: replyToId ? "Re: Your message" : "Message from Clawdbot",
        text,
        threadInfo,
        signature: account.config.signature,
      });

      return { channel: "email", ...result };
    },
  },
  actions: {
    send: async ({ cfg, params }) => {
      const { target, message, accountId, subject } = params as {
        target?: string;
        message?: string;
        accountId?: string;
        subject?: string;
      };

      if (!target) {
        return { ok: false, error: "Missing target email address (use --target or --to)" };
      }
      if (!message) {
        return { ok: false, error: "Missing message text" };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(target)) {
        return { ok: false, error: `Invalid email address: ${target}` };
      }

      const account = resolveEmailAccount({
        cfg: cfg as ClawdbotConfig,
        accountId: accountId ?? undefined,
      });

      if (!account.configured) {
        return { ok: false, error: "Email account not configured" };
      }

      const transporter = getSmtpTransporter({
        host: account.config.smtpHost,
        port: account.config.smtpPort ?? 587,
        user: account.config.smtpUser ?? account.config.imapUser,
        password: account.config.smtpPassword ?? account.config.imapPassword,
        tls: account.config.smtpTls ?? false,
        startTls: account.config.smtpStartTls ?? true,
      });

      const result = await sendEmail({
        transporter,
        from: account.email,
        to: target,
        subject: subject || "Message from Clawdbot",
        text: message,
        signature: account.config.signature,
      });

      if (result.ok) {
        return { ok: true, messageId: result.messageId, message: `Email sent to ${target}` };
      } else {
        return { ok: false, error: result.error };
      }
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastPollAt: null,
    },
    collectStatusIssues: ({ account }) => {
      // No issues if configured
      if (account?.configured) {
        return [];
      }
      
      // Check specific issues
      const issues: string[] = [];
      if (!account?.config?.imapHost) {
        issues.push("IMAP host not configured");
      }
      if (!account?.config?.smtpHost) {
        issues.push("SMTP host not configured");
      }
      if (!account?.config?.imapUser || !account?.config?.imapPassword) {
        issues.push("IMAP credentials not configured");
      }
      return issues.length > 0 ? issues : ["Email account not configured"];
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      email: snapshot.email ?? null,
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      lastPollAt: snapshot.lastPollAt ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => {
      const running = runtime?.running ?? false;
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        email: account.email,
        running,
        connected: runtime?.connected ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        lastPollAt: runtime?.lastPollAt ?? null,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        email: account.email,
        running: true,
        lastStartAt: Date.now(),
      });
      ctx.log?.info(`[${account.accountId}] Starting email monitor for ${account.email}`);

      // Dynamically import internal Clawdbot modules using resolved path
      let dispatchInboundMessageWithDispatcher: ((params: unknown) => Promise<unknown>) | null = null;
      try {
        // Find clawdbot installation path
        const clawdbotPath = require.resolve("clawdbot/plugin-sdk");
        const clawdbotRoot = clawdbotPath.replace(/[/\\]dist[/\\]plugin-sdk[/\\]index\.js$/, "");
        const dispatchPath = `${clawdbotRoot}/dist/auto-reply/dispatch.js`;
        ctx.log?.info(`[${account.accountId}] Loading dispatch module from: ${dispatchPath}`);
        const dispatchModule = await import(dispatchPath);
        dispatchInboundMessageWithDispatcher = dispatchModule.dispatchInboundMessageWithDispatcher;
        ctx.log?.info(`[${account.accountId}] Auto-reply dispatch module loaded successfully`);
      } catch (err) {
        ctx.log?.error(`[${account.accountId}] Failed to load dispatch module: ${err instanceof Error ? err.message : String(err)}`);
      }

      return monitorEmailProvider({
        account,
        config: ctx.cfg as ClawdbotConfig,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
        runtime: {
          processInbound: async (emailCtx) => {
            ctx.log?.info(`[${account.accountId}] Received email from ${emailCtx.from}: ${emailCtx.subject}`);
            ctx.setStatus({ accountId: ctx.accountId, lastInboundAt: Date.now() });

            if (!dispatchInboundMessageWithDispatcher) {
              ctx.log?.error(`[${account.accountId}] Cannot auto-reply - dispatch module not available`);
              return;
            }

            // Build inbound context for the agent
            const inboundCtx = {
              Body: `Subject: ${emailCtx.subject}\n\n${emailCtx.body}`,
              From: emailCtx.from,
              FromName: emailCtx.fromName || emailCtx.from,
              ChatType: "direct" as const,
              Channel: "email",
              AccountId: emailCtx.accountId,
              MessageId: emailCtx.messageId,
              Subject: emailCtx.subject,
              To: emailCtx.to,
              ReplyToId: emailCtx.messageId,
              ChannelId: emailCtx.to,
              Timestamp: Date.now(),
            };

            try {
              ctx.log?.info(`[${account.accountId}] Dispatching to agent for auto-reply...`);
              
              await dispatchInboundMessageWithDispatcher({
                ctx: inboundCtx,
                cfg: ctx.cfg,
                dispatcherOptions: {
                  deliver: async (payload: { text?: string }) => {
                    if (!payload.text) {
                      ctx.log?.info(`[${account.accountId}] Agent returned empty reply, skipping`);
                      return;
                    }
                    ctx.log?.info(`[${account.accountId}] Sending email reply...`);
                    const result = await emailCtx.reply(payload.text);
                    if (result.ok) {
                      ctx.log?.info(`[${account.accountId}] Email reply sent successfully`);
                      ctx.setStatus({ accountId: ctx.accountId, lastOutboundAt: Date.now() });
                    } else {
                      ctx.log?.error(`[${account.accountId}] Failed to send email reply: ${result.error}`);
                    }
                  },
                  onError: (err: Error) => {
                    ctx.log?.error(`[${account.accountId}] Agent dispatch error: ${err.message}`);
                  },
                },
              });
            } catch (err) {
              ctx.log?.error(`[${account.accountId}] Failed to dispatch email: ${err instanceof Error ? err.message : String(err)}`);
            }
          },
          logger: ctx.log,
        },
      });
    },
  },
};

export { setEmailRuntime };
