#!/usr/bin/env node
'use strict';

// Archive every message in the inbox by moving it to "All Mail".
// Reuses the mail module so behavior matches the mail_archive_messages tool.
//
// Usage:
//   node scripts/archive-inbox.js [--dry-run] [--batch 50] [--account "Google"] [--mailbox INBOX]
//
// Notes:
//   - Works in batches and loops until the mailbox is empty, so it handles
//     large inboxes without a single oversized AppleScript/JXA call.
//   - --dry-run lists what would be archived without moving anything.

const mail = require('../src/mail');

function parseArgs(argv) {
  const opts = { dryRun: false, batch: 50, account: null, mailbox: 'INBOX' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--batch') opts.batch = parseInt(argv[++i], 10);
    else if (arg === '--account') opts.account = argv[++i];
    else if (arg === '--mailbox') opts.mailbox = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(opts.batch) || opts.batch < 1 || opts.batch > 100) {
    throw new Error('--batch must be an integer between 1 and 100');
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const where = opts.account ? `${opts.account} / ${opts.mailbox}` : opts.mailbox;

  if (opts.dryRun) {
    const { items, count } = mail.listMessages({
      account: opts.account,
      mailbox: opts.mailbox,
      limit: opts.batch,
    });
    console.log(`[dry-run] ${where}: ${count} message(s) in first batch (batch size ${opts.batch}).`);
    items.forEach((m) => console.log(`  - [${m.id}] ${m.subject} — ${m.sender}`));
    console.log('[dry-run] No messages were moved. Re-run without --dry-run to archive.');
    return;
  }

  let totalArchived = 0;
  let round = 0;

  for (;;) {
    const { items } = mail.listMessages({
      account: opts.account,
      mailbox: opts.mailbox,
      limit: opts.batch,
    });
    if (!items.length) break;

    round += 1;
    const messageIds = items.map((m) => m.id);
    const result = mail.archiveMessages({ message_ids: messageIds });
    totalArchived += result.count;
    console.log(`Batch ${round}: archived ${result.count} (running total ${totalArchived}).`);
  }

  console.log(`Done. Archived ${totalArchived} message(s) from ${where} to All Mail.`);
}

try {
  main();
} catch (e) {
  console.error(`Error: ${e && e.message ? e.message : String(e)}`);
  process.exit(1);
}
