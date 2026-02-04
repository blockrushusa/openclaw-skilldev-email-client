/**
 * Email Responder Channel Plugin
 *
 * Monitors IMAP inbox and sends AI-powered replies via SMTP.
 * Works with any standard email provider (Gmail, Fastmail, self-hosted, etc.).
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { emailPlugin, setEmailRuntime } from "./src/channel.js";

const plugin = {
  id: "email",
  name: "Email Responder",
  description: "IMAP/SMTP email channel - monitors inbox and sends AI-powered replies",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    // Store runtime reference for the monitor
    setEmailRuntime({
      processInbound: async () => {
        // Will be set by channel gateway.startAccount
      },
      logger: api.logger,
    });

    // Register the email channel
    api.registerChannel({ plugin: emailPlugin });

    api.logger?.info("Email responder plugin registered");
  },
};

export default plugin;
