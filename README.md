# macos-mcp

Local MCP server for **macOS native apps**: Mail, Calendar, Reminders, Notes, Messages, and Contacts. One stdio process, zero npm dependencies, Node 20+.

**Windows and Linux are not supported.** All tools talk to local apps via AppleScript/JXA. No Gmail API, no OAuth, no cloud credentials.

## What it is

> One MCP server = one mental model: read and organize your Mac life.

| Module | App | Prefix |
|--------|-----|--------|
| Mail | Mail.app | `mail_*` |
| Calendar | Calendar.app | `calendar_*` |
| Reminders | Reminders.app | `reminders_*` |
| Notes | Notes.app | `notes_*` |
| Messages | Messages.app (`chat.db`) | `messages_*` |
| Contacts | Contacts.app | `contacts_*` |

**Email is draft-only.** `mail_draft_email` opens a visible draft in Mail.app; it never sends. You review and send manually.

## Requirements

- macOS with Mail, Calendar, Reminders, Notes, Messages configured
- Node.js ≥ 20
- [Cursor](https://cursor.com) (or any MCP client that supports stdio)

## Install

```bash
git clone <your-repo-url> macos-mcp
cd macos-mcp
node scripts/install-mcp.js
```

Restart Cursor. The installer registers `macos-local` in `~/.cursor/mcp.json` (backs up existing config to `.bak`).

Manual registration:

```json
{
  "mcpServers": {
    "macos-local": {
      "command": "node",
      "args": ["/absolute/path/to/macos-mcp/bin/macos-mcp.js"]
    }
  }
}
```

### Signatures (mail drafts)

```bash
bash scripts/install-mail-signatures.sh
```

Edit `signatures/manifest.json` and `signatures/*.txt` locally. Real signatures are gitignored.

## macOS permissions

Grant in **System Settings → Privacy & Security**:

| Permission | Needed for |
|------------|------------|
| **Automation** — allow Cursor to control Mail, Calendar, Reminders, Notes, Contacts | JXA/AppleScript modules |
| **Full Disk Access** — Cursor (or Terminal during testing) | Messages module (`~/Library/Messages/chat.db`) |

On first tool call, macOS may prompt for Automation approval per app.

## Tool index

### Mail (`mail_*`)

| Tool | Description |
|------|-------------|
| `mail_list_accounts` | List Mail accounts |
| `mail_list_mailboxes` | List mailboxes (optional account filter) |
| `mail_list_messages` | List messages in mailbox |
| `mail_search_messages` | Search subject/sender |
| `mail_get_message` | Full message by id |
| `mail_draft_email` | Open draft (never sends) |
| `mail_archive_messages` | Move to All Mail |
| `mail_trash_messages` | Move to Trash |
| `mail_mark_read` | Mark read/unread |
| `mail_move_messages` | Move to mailbox |

### Calendar (`calendar_*`)

| Tool | Description |
|------|-------------|
| `calendar_list_calendars` | List calendars |
| `calendar_list_events` | Events in date range |
| `calendar_search_events` | Search title/location |
| `calendar_get_event` | Full event |
| `calendar_create_event` | Create event |
| `calendar_update_event` | Update event |
| `calendar_delete_event` | Delete event |

### Reminders (`reminders_*`)

| Tool | Description |
|------|-------------|
| `reminders_list_lists` | List reminder lists |
| `reminders_list` | List reminders in a list |
| `reminders_search` | Search name/notes |
| `reminders_create` | Create reminder |
| `reminders_complete` | Mark complete |
| `reminders_delete` | Delete reminder |

### Notes (`notes_*`)

| Tool | Description |
|------|-------------|
| `notes_list_folders` | List folders |
| `notes_list` | List notes |
| `notes_search` | Search title/body |
| `notes_get` | Get note body |
| `notes_create` | Create note |
| `notes_append` | Append to note |

On newer macOS, note body extraction may fail; `notes_get` returns `body_unavailable: true` when scripting is restricted.

**Calendar queries can be slow** (several seconds per calendar) on accounts with large histories. Pass `calendar` to narrow the search.

### Messages (`messages_*`)

| Tool | Description |
|------|-------------|
| `messages_get_thread` | Thread by phone/email substring |
| `messages_list_chats` | Recent chats |

Requires **Full Disk Access**. Reads iMessage/SMS locally; no network.

### Contacts (`contacts_*`)

| Tool | Description |
|------|-------------|
| `contacts_search` | Search by name/email/phone |
| `contacts_get` | Full contact card |
| `contacts_create` | Create contact |
| `contacts_update` | Update contact |

## Architecture

```
bin/macos-mcp.js          → entrypoint
src/mcp/server.js         → JSON-RPC MCP (protocol 2024-11-05)
src/mcp/transport.js      → stdio NDJSON
src/mcp/tools.js          → aggregates all module tools
src/runtime/jxa.js        → generic JXA runner (Application per app)
src/runtime/applescript.js → AppleScript runner + draft email
src/mail/                 → Mail module
src/calendar/             → Calendar module
...
```

**JXA vs AppleScript**

- **JXA** (`osascript -l JavaScript`): read/list/search most app data; generic `runJxa(appName, body, args)`.
- **AppleScript**: `mail_draft_email` and calendar create/update/delete (JXA `make` is unreliable on modern Calendar.app).

**Response shapes:** lists include `count`; domain keys vary (`items`, `events`, `reminders`, `notes`, `chats`, `contacts`). Errors throw and return MCP `isError: true`.

## Mail.app quirks

- Saved drafts may retain a leading newline Mail adds on save; the compose window is usually correct.
- AppleScript does not auto-attach Mail.app signature prefs; this server appends from `signatures/` files instead.

## What it is NOT

- No Gmail API, Microsoft Graph, or OAuth
- No auto-send email
- No npm publish (`private: true`)
- No telemetry or network calls in server code

## Development

```bash
npm start   # runs stdio server (stderr: [macos-mcp] ready; N tools; macOS only)
```

Test a tool via MCP client or send JSON-RPC to stdin.

## License

MIT
