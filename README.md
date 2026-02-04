# Email Plugin for Clawdbot

📧 IMAP monitoring + SMTP sending with AI-powered auto-replies.

## Setup

```yaml
channels:
  email:
    enabled: true
    imapHost: imap.gmail.com
    imapUser: you@gmail.com
    imapPassword: your-app-password
    smtpHost: smtp.gmail.com
```

## Sender Filtering

```yaml
channels:
  email:
    # "open" (default) | "allowlist" | "blocklist"
    filterMode: open
    
    # Only respond to these (when filterMode: allowlist)
    allowFrom:
      - "trusted@example.com"
      - "*@company.com"
    
    # Block these (checked in all modes)
    blockFrom:
      - "spam@example.com"
```

## All Options

| Option | Default | Description |
|--------|---------|-------------|
| `imapHost` | — | IMAP server |
| `imapPort` | 993 | IMAP port |
| `imapUser` | — | Email address |
| `imapPassword` | — | App password |
| `smtpHost` | — | SMTP server |
| `smtpPort` | 587 | SMTP port |
| `pollIntervalSeconds` | 60 | Check interval |
| `folder` | INBOX | Folder to monitor |
| `filterMode` | open | open/allowlist/blocklist |
| `allowFrom` | [] | Allowed senders |
| `blockFrom` | [] | Blocked senders |
| `maxRepliesPerSenderPerHour` | 5 | Rate limit |
| `signature` | — | Email signature |

## Features

- IMAP IDLE + polling
- SMTP outbound
- Auto-reply detection (skips noreply@, mailer-daemon@)
- Email threading (In-Reply-To, References)
- Rate limiting
- Wildcard patterns (`*@domain.com`)

## Provider Notes

- **Gmail**: Use [App Password](https://myaccount.google.com/apppasswords)
- **Outlook**: `imap.office365.com` / `smtp.office365.com`
- **Fastmail**: App password from Settings → Security

## State

`~/.clawdbot/email-responder/state.json`

---

MIT · [Blockrush](https://www.blockrush.com)
