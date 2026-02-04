# Email Plugin for Clawdbot

📧 IMAP monitoring + SMTP replies with AI.

## Install

**Step 1:** Install the package
```bash
npm install github:blockrushusa/openclaw-skilldev-email-client
```

**Step 2:** Add to your `clawdbot.yaml`:
```yaml
plugins:
  entries:
    email:
      enabled: true
      package: "@clawdbot/email"

channels:
  email:
    enabled: true
    provider: gmail
    imapUser: you@gmail.com
    imapPassword: xxxx-xxxx-xxxx-xxxx
```

**Step 3:** Restart
```bash
clawdbot gateway restart
```

## Quick Setup

### Gmail
```yaml
channels:
  email:
    enabled: true
    provider: gmail
    imapUser: you@gmail.com
    imapPassword: xxxx-xxxx-xxxx-xxxx  # App password, NOT your regular password
```

### Outlook / Office365
```yaml
channels:
  email:
    enabled: true
    provider: outlook
    imapUser: you@outlook.com
    imapPassword: your-app-password
```

### Fastmail
```yaml
channels:
  email:
    enabled: true
    provider: fastmail
    imapUser: you@fastmail.com
    imapPassword: your-app-password
```

### Other Providers
```yaml
channels:
  email:
    enabled: true
    imapHost: imap.example.com
    imapUser: you@example.com
    imapPassword: your-password
    smtpHost: smtp.example.com
```

## Getting an App Password

Most providers require an "app password" instead of your regular password.

**Gmail:**
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Copy the 16-character password (spaces don't matter)

**Outlook:**
1. Go to [Microsoft Security](https://account.microsoft.com/security)
2. Enable 2FA if not already
3. Create an app password

**Fastmail:**
1. Settings → Password & Security → App Passwords
2. Create new password for "IMAP"

## Supported Providers

| Provider | Value |
|----------|-------|
| Gmail | `gmail` |
| Outlook/Hotmail/Live | `outlook` |
| Fastmail | `fastmail` |
| iCloud | `icloud` |
| Yahoo | `yahoo` |
| Zoho | `zoho` |
| ProtonMail | `protonmail` (requires Bridge) |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | — | Provider shortcut (gmail, outlook, etc.) |
| `imapHost` | — | IMAP server (not needed if provider set) |
| `imapUser` | — | Your email address |
| `imapPassword` | — | App password |
| `smtpHost` | — | SMTP server (not needed if provider set) |
| `pollIntervalSeconds` | 60 | Check frequency |
| `folder` | INBOX | Folder to monitor |
| `filterMode` | open | open/allowlist/blocklist |
| `allowFrom` | [] | Allowed senders (`*@company.com`) |
| `blockFrom` | [] | Blocked senders |
| `maxRepliesPerSenderPerHour` | 60 | Rate limit |
| `signature` | — | Appended to replies |

## Sender Filtering

```yaml
channels:
  email:
    filterMode: allowlist
    allowFrom:
      - "boss@company.com"
      - "*@trustedcorp.com"
    blockFrom:
      - "spam@example.com"
```

---

MIT · [Blockrush](https://www.blockrush.com)
