'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Build an AppleScript string expression that preserves line breaks. */
function applescriptString(s) {
  const chunks = [];
  let current = '';
  for (const ch of String(s)) {
    if (ch === '\n') {
      if (current.length) {
        chunks.push(`"${esc(current)}"`);
        current = '';
      }
      chunks.push('linefeed');
    } else if (ch !== '\r') {
      current += ch;
    }
  }
  if (current.length) chunks.push(`"${esc(current)}"`);
  if (chunks.length === 0) return '""';
  if (chunks.length === 1) return chunks[0];
  return chunks.join(' & ');
}

function runAppleScript(script, { timeoutMs = 120_000 } = {}) {
  try {
    return execFileSync('osascript', ['-e', script], {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || String(e)).trim();
    const err = new Error(msg || 'AppleScript execution failed');
    err.cause = e;
    throw err;
  }
}

function resolveAttachments(attachments = []) {
  return attachments.map((raw) => {
    const abs = path.resolve(String(raw).replace(/^~(?=\/|$)/, process.env.HOME || ''));
    if (!fs.existsSync(abs)) throw new Error(`Attachment not found: ${abs}`);
    return abs;
  });
}

function draftEmailAppleScript({ to = [], cc = [], bcc = [], subject = '', body = '', sender = null, attachments = [] }) {
  if (!to.length) throw new Error('to is required');
  const files = resolveAttachments(attachments);
  const toLines = to
    .map((addr) => `make new to recipient at end of to recipients of theMessage with properties {address:"${esc(addr)}"}`)
    .join('\n    ');
  const ccLines = (cc || [])
    .map((addr) => `make new cc recipient at end of cc recipients of theMessage with properties {address:"${esc(addr)}"}`)
    .join('\n    ');
  const bccLines = (bcc || [])
    .map((addr) => `make new bcc recipient at end of bcc recipients of theMessage with properties {address:"${esc(addr)}"}`)
    .join('\n    ');
  const senderProp = sender ? `, sender:"${esc(sender)}"` : '';
  const attachLines = files
    .map(
      (f) =>
        `make new attachment with properties {file name:(POSIX file "${esc(f)}")} at after the last paragraph of content of theMessage`
    )
    .join('\n    ');
  const script = `
tell application "Mail" to activate
tell application "Mail"
  set theMessage to make new outgoing message with properties {subject:${applescriptString(subject)}, visible:true${senderProp}}
  set content of theMessage to ${applescriptString(body)}
  tell theMessage
    ${toLines}
    ${ccLines}
    ${bccLines}
    ${attachLines}
  end tell
  try
    set c to content of theMessage
    if (length of c) > 0 and character 1 of c is return then set content of theMessage to text 2 thru -1 of c
  end try
end tell
return "ok"
`;
  runAppleScript(script);
  return { draft: true, subject, to, cc: cc || [], bcc: bcc || [], sender: sender || null, attachments: files };
}

function isoToAppleScriptDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (n) => String(n).padStart(2, '0');
  const h = d.getHours();
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hour12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

function createCalendarEventAppleScript({ calendar, summary, start, end, location, notes }) {
  const props = [
    `summary:"${esc(summary)}"`,
    `start date:date "${isoToAppleScriptDate(start)}"`,
    `end date:date "${isoToAppleScriptDate(end)}"`,
  ];
  if (location) props.push(`location:"${esc(location)}"`);
  if (notes) props.push(`description:"${esc(notes)}"`);
  const script = `
tell application "Calendar"
  tell calendar "${esc(calendar)}"
    set newEvent to make new event with properties {${props.join(', ')}}
    return uid of newEvent
  end tell
end tell`;
  const uid = runAppleScript(script);
  return { uid, summary, start, end, calendar };
}

function updateCalendarEventAppleScript({ calendar, uid, summary, start, end, location, notes }) {
  const lines = [];
  if (summary != null) lines.push(`set summary of theEvent to "${esc(summary)}"`);
  if (start) lines.push(`set start date of theEvent to date "${isoToAppleScriptDate(start)}"`);
  if (end) lines.push(`set end date of theEvent to date "${isoToAppleScriptDate(end)}"`);
  if (location != null) lines.push(`set location of theEvent to "${esc(location)}"`);
  if (notes != null) lines.push(`set description of theEvent to "${esc(notes)}"`);
  if (!lines.length) throw new Error('No fields to update');
  const calClause = calendar ? `calendar "${esc(calendar)}"` : 'calendars';
  const script = `
tell application "Calendar"
  set theEvent to missing value
  repeat with cal in ${calClause}
    try
      set theEvent to first event of cal whose uid is "${esc(uid)}"
      exit repeat
    end try
  end repeat
  if theEvent is missing value then error "Event not found"
  ${lines.join('\n  ')}
  return uid of theEvent
end tell`;
  runAppleScript(script);
  return { uid, updated: true };
}

function getCalendarEventAppleScript({ calendar, uid }) {
  const script = calendar
    ? `
tell application "Calendar"
  tell calendar "${esc(calendar)}"
    set theEvent to first event whose uid is "${esc(uid)}"
    set s to start date of theEvent
    set e to end date of theEvent
    set loc to ""
    set desc to ""
    try
      set loc to location of theEvent
    end try
    try
      set desc to description of theEvent
    end try
    return "${esc(uid)}" & tab & (summary of theEvent) & tab & (s as string) & tab & (e as string) & tab & loc & tab & desc & tab & "${esc(calendar)}"
  end tell
end tell`
    : `
tell application "Calendar"
  set theEvent to missing value
  set calName to ""
  repeat with cal in calendars
    try
      set theEvent to first event of cal whose uid is "${esc(uid)}"
      set calName to name of cal
      exit repeat
    end try
  end repeat
  if theEvent is missing value then error "Event not found"
  set s to start date of theEvent
  set e to end date of theEvent
  set loc to ""
  set desc to ""
  try
    set loc to location of theEvent
  end try
  try
    set desc to description of theEvent
  end try
  return "${esc(uid)}" & tab & (summary of theEvent) & tab & (s as string) & tab & (e as string) & tab & loc & tab & desc & tab & calName
end tell`;
  const out = runAppleScript(script);
  const [uidOut, summary, start, end, location, notes, calOut] = out.split('\t');
  return {
    uid: uidOut,
    summary,
    start,
    end,
    location: location || '',
    notes: notes || '',
    calendar: calOut || calendar || null,
  };
}

function deleteCalendarEventAppleScript({ calendar, uid }) {
  const script = calendar
    ? `
tell application "Calendar"
  delete (first event of calendar "${esc(calendar)}" whose uid is "${esc(uid)}")
end tell`
    : `
tell application "Calendar"
  set deleted to false
  repeat with cal in calendars
    try
      delete (first event of cal whose uid is "${esc(uid)}")
      set deleted to true
      exit repeat
    end try
  end repeat
  if not deleted then error "Event not found"
end tell`;
  runAppleScript(script);
  return { deleted: true, uid };
}

module.exports = {
  runAppleScript,
  draftEmailAppleScript,
  esc,
  applescriptString,
  isoToAppleScriptDate,
  createCalendarEventAppleScript,
  updateCalendarEventAppleScript,
  getCalendarEventAppleScript,
  deleteCalendarEventAppleScript,
};
