'use strict';

const { runMailJxa } = require('../runtime/jxa');
const { draftEmailAppleScript, saveMessageAttachmentsAppleScript } = require('../runtime/applescript');
const { appendSignature } = require('./signatures');
const { sanitizeOutgoingEmail, normalizeDraftBody } = require('./outgoing');

function listAccounts() {
  return runMailJxa(`
    const out = Mail.accounts().map(function (a) {
      return { name: a.name(), emails: a.emailAddresses() };
    });
    JSON.stringify({ accounts: out, count: out.length });
  `);
}

function listMailboxes({ account } = {}) {
  return runMailJxa(
    `
    let accts = args.account ? Mail.accounts.whose({ name: args.account }) : Mail.accounts();
    const mailboxes = [];
    accts.forEach(function (a) {
      a.mailboxes().forEach(function (mb) {
        mailboxes.push({ account: a.name(), name: mb.name() });
      });
    });
    JSON.stringify({ items: mailboxes, count: mailboxes.length });
  `,
    { account: account || null }
  );
}

function resolveMailbox(account, mailbox) {
  const mb = mailbox || 'INBOX';
  if (account) {
    return `
      const acct = Mail.accounts.whose({ name: args.account })[0];
      if (!acct) throw new Error('Account not found: ' + args.account);
      const box = acct.mailboxes.whose({ name: args.mailbox })[0];
      if (!box) throw new Error('Mailbox not found: ' + args.mailbox);
    `;
  }
  if (mb.toUpperCase() === 'INBOX') return 'const box = Mail.inbox();';
  return `
    const box = Mail.mailboxes.whose({ name: args.mailbox })[0];
    if (!box) throw new Error('Mailbox not found: ' + args.mailbox);
  `;
}

function listMessages({ account, mailbox, limit = 25, unread_only = false } = {}) {
  const boxInit = resolveMailbox(account, mailbox || 'INBOX');
  return runMailJxa(
    `
    ${boxInit}
    let msgs = box.messages();
    if (args.unread_only) msgs = msgs.whose({ readStatus: false });
    msgs = msgs.slice(0, args.limit);
    const out = msgs.map(function (m) {
      return {
        id: m.id(),
        subject: m.subject(),
        sender: m.sender(),
        read: m.readStatus(),
        date: m.dateReceived().toString(),
        mailbox: box.name(),
      };
    });
    JSON.stringify({ items: out, count: out.length });
  `,
    { account: account || null, mailbox: mailbox || 'INBOX', limit, unread_only }
  );
}

function searchMessages({ account, mailbox, query, limit = 25, unread_only = false } = {}) {
  if (!query) throw new Error('query is required');
  const boxInit = resolveMailbox(account, mailbox || 'INBOX');
  return runMailJxa(
    `
    ${boxInit}
    const q = String(args.query).toLowerCase();
    let msgs = box.messages();
    if (args.unread_only) msgs = msgs.whose({ readStatus: false });
    const out = [];
    for (let i = 0; i < msgs.length && out.length < args.limit; i++) {
      const m = msgs[i];
      const hay = (m.subject() + ' ' + m.sender()).toLowerCase();
      if (hay.indexOf(q) >= 0) {
        out.push({
          id: m.id(),
          subject: m.subject(),
          sender: m.sender(),
          read: m.readStatus(),
          date: m.dateReceived().toString(),
          mailbox: box.name(),
        });
      }
    }
    JSON.stringify({ items: out, count: out.length, query: args.query });
  `,
    { account: account || null, mailbox: mailbox || 'INBOX', query, limit, unread_only }
  );
}

function getMessage({ message_id } = {}) {
  if (message_id == null) throw new Error('message_id is required');
  return runMailJxa(
    `
    const id = args.message_id;
    const inbox = Mail.inbox();
    let found = inbox.messages.whose({ id: id });
    if (!found.length) {
      Mail.accounts().some(function (a) {
        return a.mailboxes().some(function (mb) {
          const hits = mb.messages.whose({ id: id });
          if (hits.length) { found = hits; return true; }
          return false;
        });
      });
    }
    if (!found.length) throw new Error('Message not found: ' + id);
    const m = found[0];
    JSON.stringify({
      id: m.id(),
      subject: m.subject(),
      sender: m.sender(),
      to_recipients: m.toRecipients(),
      cc_recipients: m.ccRecipients(),
      read: m.readStatus(),
      date: m.dateReceived().toString(),
      content: m.content(),
    });
  `,
    { message_id }
  );
}

function draftEmail(opts = {}) {
  if (!opts.to || !opts.to.length) throw new Error('to is required (array of email addresses)');

  const signatureMode = opts.signature === undefined ? 'default' : opts.signature;
  const subject = sanitizeOutgoingEmail(opts.subject || '');
  const { body, ...sigMeta } = appendSignature({
    body: sanitizeOutgoingEmail(opts.body || ''),
    sender: opts.sender || null,
    signature: signatureMode,
  });

  const normalizedBody = normalizeDraftBody(body);
  const result = draftEmailAppleScript({ ...opts, subject, body: normalizedBody });
  return { ...result, ...sigMeta };
}

function archiveMessages({ message_ids = [] } = {}) {
  if (!message_ids.length) throw new Error('message_ids is required');
  return runMailJxa(
    `
    const ids = args.message_ids;
    const acct = Mail.accounts()[0];
    const dest = acct.mailboxes.whose({ name: 'All Mail' })[0];
    if (!dest) throw new Error('All Mail mailbox not found');
    const archived = [];
    ids.forEach(function (id) {
      let hits = Mail.inbox.messages.whose({ id: id });
      if (!hits.length) {
        Mail.accounts().some(function (a) {
          return a.mailboxes().some(function (mb) {
            const h = mb.messages.whose({ id: id });
            if (h.length) { hits = h; return true; }
            return false;
          });
        });
      }
      if (!hits.length) throw new Error('Message not found: ' + id);
      const m = hits[0];
      archived.push({ id: m.id(), subject: m.subject() });
      m.move({ to: dest });
    });
    JSON.stringify({ items: archived, count: archived.length });
  `,
    { message_ids }
  );
}

function trashMessages({ message_ids = [] } = {}) {
  if (!message_ids.length) throw new Error('message_ids is required');
  return runMailJxa(
    `
    const ids = args.message_ids;
    const acct = Mail.accounts()[0];
    const dest = acct.mailboxes.whose({ name: 'Trash' })[0];
    if (!dest) throw new Error('Trash mailbox not found');
    const trashed = [];
    ids.forEach(function (id) {
      let hits = Mail.inbox.messages.whose({ id: id });
      if (!hits.length) {
        Mail.accounts().some(function (a) {
          return a.mailboxes().some(function (mb) {
            const h = mb.messages.whose({ id: id });
            if (h.length) { hits = h; return true; }
            return false;
          });
        });
      }
      if (!hits.length) throw new Error('Message not found: ' + id);
      const m = hits[0];
      trashed.push({ id: m.id(), subject: m.subject() });
      m.move({ to: dest });
    });
    JSON.stringify({ items: trashed, count: trashed.length });
  `,
    { message_ids }
  );
}

function markRead({ message_ids = [], read = true } = {}) {
  if (!message_ids.length) throw new Error('message_ids is required');
  return runMailJxa(
    `
    const ids = args.message_ids;
    const updated = [];
    ids.forEach(function (id) {
      let hits = Mail.inbox.messages.whose({ id: id });
      if (!hits.length) {
        Mail.accounts().some(function (a) {
          return a.mailboxes().some(function (mb) {
            const h = mb.messages.whose({ id: id });
            if (h.length) { hits = h; return true; }
            return false;
          });
        });
      }
      if (!hits.length) throw new Error('Message not found: ' + id);
      const m = hits[0];
      m.readStatus = args.read;
      updated.push({ id: m.id(), subject: m.subject(), read: m.readStatus() });
    });
    JSON.stringify({ items: updated, count: updated.length });
  `,
    { message_ids, read }
  );
}

function moveMessages({ message_ids = [], mailbox, account } = {}) {
  if (!message_ids.length) throw new Error('message_ids is required');
  if (!mailbox) throw new Error('mailbox is required');
  return runMailJxa(
    `
    const ids = args.message_ids;
    let dest;
    if (args.account) {
      const acct = Mail.accounts.whose({ name: args.account })[0];
      if (!acct) throw new Error('Account not found: ' + args.account);
      dest = acct.mailboxes.whose({ name: args.mailbox })[0];
    } else {
      dest = Mail.mailboxes.whose({ name: args.mailbox })[0];
      if (!dest) {
        Mail.accounts().some(function (a) {
          const hit = a.mailboxes.whose({ name: args.mailbox });
          if (hit.length) { dest = hit[0]; return true; }
          return false;
        });
      }
    }
    if (!dest) throw new Error('Mailbox not found: ' + args.mailbox);
    const moved = [];
    ids.forEach(function (id) {
      let hits = Mail.inbox.messages.whose({ id: id });
      if (!hits.length) {
        Mail.accounts().some(function (a) {
          return a.mailboxes().some(function (mb) {
            const h = mb.messages.whose({ id: id });
            if (h.length) { hits = h; return true; }
            return false;
          });
        });
      }
      if (!hits.length) throw new Error('Message not found: ' + id);
      const m = hits[0];
      moved.push({ id: m.id(), subject: m.subject(), mailbox: args.mailbox });
      m.move({ to: dest });
    });
    JSON.stringify({ items: moved, count: moved.length });
  `,
    { message_ids, mailbox, account: account || null }
  );
}

function saveAttachments({ message_id, output_dir } = {}) {
  return saveMessageAttachmentsAppleScript({ message_id, output_dir });
}

module.exports = {
  listAccounts,
  listMailboxes,
  listMessages,
  searchMessages,
  getMessage,
  draftEmail,
  saveAttachments,
  archiveMessages,
  trashMessages,
  markRead,
  moveMessages,
};
