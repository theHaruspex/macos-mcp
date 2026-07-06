'use strict';

const mail = require('../mail');
const calendar = require('../calendar/calendar');
const reminders = require('../reminders/reminders');
const notes = require('../notes/notes');
const messages = require('../messages/messages');
const contacts = require('../contacts/contacts');

function buildMailTools() {
  return [
    {
      name: 'mail_list_accounts',
      description: 'List Mail.app accounts configured on this Mac (name + email addresses).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => mail.listAccounts(),
    },
    {
      name: 'mail_list_mailboxes',
      description: 'List mailboxes. Optionally filter by Mail account name.',
      inputSchema: {
        type: 'object',
        properties: { account: { type: 'string', description: 'Mail account name filter.' } },
        additionalProperties: false,
      },
      handler: async (args) => mail.listMailboxes(args),
    },
    {
      name: 'mail_list_messages',
      description: 'List recent messages from a mailbox (default INBOX). Returns Mail message ids for follow-up actions.',
      inputSchema: {
        type: 'object',
        properties: {
          account: { type: 'string' },
          mailbox: { type: 'string', default: 'INBOX' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          unread_only: { type: 'boolean', default: false },
        },
        additionalProperties: false,
      },
      handler: async (args) => mail.listMessages(args),
    },
    {
      name: 'mail_search_messages',
      description: 'Search messages by substring in subject or sender within a mailbox.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          account: { type: 'string' },
          mailbox: { type: 'string', default: 'INBOX' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          unread_only: { type: 'boolean', default: false },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: async (args) => mail.searchMessages(args),
    },
    {
      name: 'mail_get_message',
      description: 'Fetch full message content by Mail message id.',
      inputSchema: {
        type: 'object',
        properties: { message_id: { type: 'integer' } },
        required: ['message_id'],
        additionalProperties: false,
      },
      handler: async (args) => mail.getMessage(args),
    },
    {
      name: 'mail_save_attachments',
      description: 'Save all attachments from a Mail message to a local directory.',
      inputSchema: {
        type: 'object',
        properties: {
          message_id: { type: 'integer' },
          output_dir: {
            type: 'string',
            description: 'Directory to save files into (absolute or ~ path). Created if missing.',
          },
        },
        required: ['message_id', 'output_dir'],
        additionalProperties: false,
      },
      handler: async (args) => mail.saveAttachments(args),
    },
    {
      name: 'mail_draft_email',
      description:
        'Open a draft in Mail.app (never sends). Appends signature from signatures/ when sender is set. Em dashes are stripped from subject/body.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'array', items: { type: 'string' }, minItems: 1 },
          cc: { type: 'array', items: { type: 'string' } },
          bcc: { type: 'array', items: { type: 'string' } },
          subject: { type: 'string' },
          body: { type: 'string' },
          sender: { type: 'string', description: 'From address; must match a Mail account.' },
          attachments: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute file paths to attach (~ is expanded). Files must exist.',
          },
          signature: {
            type: 'string',
            enum: ['default', 'with-founder', 'none'],
            default: 'default',
            description: 'Signature variant from signatures/manifest.json.',
          },
        },
        required: ['to'],
        additionalProperties: false,
      },
      handler: async (args) => mail.draftEmail(args),
    },
    {
      name: 'mail_draft_reply',
      description:
        'Open a reply draft in Mail.app for an existing message (never sends). Keeps the thread. Use message_id from mail_list_messages or mail_search_messages.',
      inputSchema: {
        type: 'object',
        properties: {
          message_id: { type: 'integer', description: 'Mail message id to reply to.' },
          body: { type: 'string' },
          sender: { type: 'string', description: 'From address; must match a Mail account.' },
          reply_all: { type: 'boolean', default: false },
          attachments: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute file paths to attach (~ is expanded). Files must exist.',
          },
          signature: {
            type: 'string',
            enum: ['default', 'with-founder', 'none'],
            default: 'default',
            description: 'Signature variant from signatures/manifest.json.',
          },
        },
        required: ['message_id'],
        additionalProperties: false,
      },
      handler: async (args) => mail.draftReply(args),
    },
    {
      name: 'mail_archive_messages',
      description: 'Archive messages by id (Gmail: move to All Mail / remove from Inbox).',
      inputSchema: {
        type: 'object',
        properties: {
          message_ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
        },
        required: ['message_ids'],
        additionalProperties: false,
      },
      handler: async (args) => mail.archiveMessages(args),
    },
    {
      name: 'mail_trash_messages',
      description: 'Move messages to Trash by id.',
      inputSchema: {
        type: 'object',
        properties: {
          message_ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
        },
        required: ['message_ids'],
        additionalProperties: false,
      },
      handler: async (args) => mail.trashMessages(args),
    },
    {
      name: 'mail_mark_read',
      description: 'Mark messages read or unread by id.',
      inputSchema: {
        type: 'object',
        properties: {
          message_ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
          read: { type: 'boolean', default: true },
        },
        required: ['message_ids'],
        additionalProperties: false,
      },
      handler: async (args) => mail.markRead(args),
    },
    {
      name: 'mail_move_messages',
      description: 'Move messages to another mailbox.',
      inputSchema: {
        type: 'object',
        properties: {
          message_ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
          mailbox: { type: 'string' },
          account: { type: 'string' },
        },
        required: ['message_ids', 'mailbox'],
        additionalProperties: false,
      },
      handler: async (args) => mail.moveMessages(args),
    },
  ];
}

function buildCalendarTools() {
  return [
    {
      name: 'calendar_list_calendars',
      description: 'List Calendar.app calendars with writable flag.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => calendar.listCalendars(),
    },
    {
      name: 'calendar_list_events',
      description: 'List events in a date range (ISO 8601 start/end).',
      inputSchema: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'ISO 8601 start date/time.' },
          end: { type: 'string', description: 'ISO 8601 end date/time.' },
          calendar: { type: 'string', description: 'Optional calendar name filter.' },
        },
        required: ['start', 'end'],
        additionalProperties: false,
      },
      handler: async (args) => calendar.listEvents(args),
    },
    {
      name: 'calendar_search_events',
      description: 'Search events by substring in title or location.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          calendar: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: async (args) => calendar.searchEvents(args),
    },
    {
      name: 'calendar_get_event',
      description: 'Get full event by uid.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string' },
          calendar: { type: 'string', description: 'Optional calendar name to narrow search.' },
        },
        required: ['uid'],
        additionalProperties: false,
      },
      handler: async (args) => calendar.getEvent(args),
    },
    {
      name: 'calendar_create_event',
      description: 'Create a calendar event.',
      inputSchema: {
        type: 'object',
        properties: {
          calendar: { type: 'string' },
          summary: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          location: { type: 'string' },
          notes: { type: 'string' },
          alarms: { type: 'array', items: { type: 'number' }, description: 'Minutes before start.' },
        },
        required: ['calendar', 'summary', 'start', 'end'],
        additionalProperties: false,
      },
      handler: async (args) => calendar.createEvent(args),
    },
    {
      name: 'calendar_update_event',
      description: 'Update event fields by uid.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string' },
          calendar: { type: 'string' },
          summary: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          location: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['uid'],
        additionalProperties: false,
      },
      handler: async (args) => calendar.updateEvent(args),
    },
    {
      name: 'calendar_delete_event',
      description: 'Delete an event by uid.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string' },
          calendar: { type: 'string' },
        },
        required: ['uid'],
        additionalProperties: false,
      },
      handler: async (args) => calendar.deleteEvent(args),
    },
  ];
}

function buildRemindersTools() {
  return [
    {
      name: 'reminders_list_lists',
      description: 'List all Reminders lists.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => reminders.listLists(),
    },
    {
      name: 'reminders_list',
      description: 'List reminders in a list with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          list: { type: 'string' },
          completed: { type: 'boolean' },
          due_before: { type: 'string', description: 'ISO 8601 date.' },
          due_after: { type: 'string', description: 'ISO 8601 date.' },
        },
        required: ['list'],
        additionalProperties: false,
      },
      handler: async (args) => reminders.listReminders(args),
    },
    {
      name: 'reminders_search',
      description: 'Search reminders by substring in name or notes.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          list: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: async (args) => reminders.searchReminders(args),
    },
    {
      name: 'reminders_create',
      description: 'Create a reminder in a list.',
      inputSchema: {
        type: 'object',
        properties: {
          list: { type: 'string' },
          name: { type: 'string' },
          due: { type: 'string', description: 'ISO 8601 due date/time.' },
          notes: { type: 'string' },
          priority: { type: 'integer', minimum: 0, maximum: 9 },
        },
        required: ['list', 'name'],
        additionalProperties: false,
      },
      handler: async (args) => reminders.createReminder(args),
    },
    {
      name: 'reminders_complete',
      description: 'Mark a reminder complete by id or name+list.',
      inputSchema: {
        type: 'object',
        properties: {
          reminder_id: { type: 'string' },
          name: { type: 'string' },
          list: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => reminders.completeReminder(args),
    },
    {
      name: 'reminders_delete',
      description: 'Delete a reminder by id or name+list.',
      inputSchema: {
        type: 'object',
        properties: {
          reminder_id: { type: 'string' },
          name: { type: 'string' },
          list: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => reminders.deleteReminder(args),
    },
  ];
}

function buildNotesTools() {
  return [
    {
      name: 'notes_list_folders',
      description: 'List Notes.app folders.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => notes.listFolders(),
    },
    {
      name: 'notes_list',
      description: 'List notes, optionally filtered by folder.',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
        additionalProperties: false,
      },
      handler: async (args) => notes.listNotes(args),
    },
    {
      name: 'notes_search',
      description: 'Search notes by substring in title or body.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          folder: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: async (args) => notes.searchNotes(args),
    },
    {
      name: 'notes_get',
      description: 'Get note title and body by id or name.',
      inputSchema: {
        type: 'object',
        properties: {
          note_id: { type: 'integer' },
          name: { type: 'string' },
          folder: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => notes.getNote(args),
    },
    {
      name: 'notes_create',
      description: 'Create a note in a folder (may require macOS automation permission).',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string' },
          name: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['folder', 'name'],
        additionalProperties: false,
      },
      handler: async (args) => notes.createNote(args),
    },
    {
      name: 'notes_append',
      description: 'Append text to an existing note.',
      inputSchema: {
        type: 'object',
        properties: {
          note_id: { type: 'integer' },
          name: { type: 'string' },
          folder: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },
      handler: async (args) => notes.appendNote(args),
    },
  ];
}

function buildMessagesTools() {
  return [
    {
      name: 'messages_get_thread',
      description:
        'Read iMessage/SMS thread by phone substring or email. Requires Full Disk Access for chat.db.',
      inputSchema: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'Phone substring or email to match.' },
        },
        required: ['handle'],
        additionalProperties: false,
      },
      handler: async (args) => messages.getThread(args),
    },
    {
      name: 'messages_list_chats',
      description: 'List recent chat identifiers from Messages.app.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        },
        additionalProperties: false,
      },
      handler: async (args) => messages.listChats(args),
    },
  ];
}

function buildContactsTools() {
  return [
    {
      name: 'contacts_list',
      description: 'List contacts. Optionally return only contacts missing an email address.',
      inputSchema: {
        type: 'object',
        properties: {
          missing_email: { type: 'boolean', default: false },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        },
        additionalProperties: false,
      },
      handler: async (args) => contacts.listContacts(args),
    },
    {
      name: 'contacts_search',
      description: 'Search Contacts by name, email, or phone substring.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
      handler: async (args) => contacts.searchContacts(args),
    },
    {
      name: 'contacts_get',
      description: 'Get full contact card by id or name.',
      inputSchema: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contacts.app person id (UUID:ABPerson).' },
          name: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => contacts.getContact(args),
    },
    {
      name: 'contacts_create',
      description: 'Create a new contact with basic fields.',
      inputSchema: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          organization: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => contacts.createContact(args),
    },
    {
      name: 'contacts_update',
      description: 'Update contact fields by contact_id.',
      inputSchema: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contacts.app person id (UUID:ABPerson).' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          organization: { type: 'string' },
        },
        required: ['contact_id'],
        additionalProperties: false,
      },
      handler: async (args) => contacts.updateContact(args),
    },
    {
      name: 'contacts_delete',
      description: 'Delete a contact by Contacts.app person id.',
      inputSchema: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contacts.app person id (UUID:ABPerson).' },
        },
        required: ['contact_id'],
        additionalProperties: false,
      },
      handler: async (args) => contacts.deleteContact(args),
    },
    {
      name: 'contacts_import_csv',
      description:
        'Import contacts from a Google Contacts CSV export. Upserts by email, optionally removes name-only duplicates.',
      inputSchema: {
        type: 'object',
        properties: {
          csv_path: { type: 'string', description: 'Absolute or ~ path to the CSV file.' },
          organization: {
            type: 'string',
            description: 'Default organization when CSV Organization Name is blank.',
            default: 'eCustom Solutions',
          },
          dedupe: {
            type: 'boolean',
            description: 'Delete same-name contacts that have no email after import.',
            default: true,
          },
        },
        required: ['csv_path'],
        additionalProperties: false,
      },
      handler: async (args) => contacts.importContactsCsv(args),
    },
  ];
}

function buildTools() {
  return [
    ...buildMailTools(),
    ...buildCalendarTools(),
    ...buildRemindersTools(),
    ...buildNotesTools(),
    ...buildMessagesTools(),
    ...buildContactsTools(),
  ];
}

module.exports = { buildTools };
