'use strict';

const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 120_000;
const CHAT_DB = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

const THREAD_PY = `
import sqlite3, re, sys, json
needle = sys.argv[1]
db = __import__('pathlib').Path.home() / 'Library/Messages/chat.db'
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row

def body(row):
    if row['text']: return row['text']
    b = row['attributedBody']
    if not b: return ''
    if isinstance(b, memoryview): b = b.tobytes()
    m = re.search(rb'[\\x20-\\x7e\\n\\r\\t]{8,}', b)
    return m.group(0).decode('utf-8','ignore') if m else ''

rows = conn.execute('''
SELECT c.chat_identifier, h.id handle,
       datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') dt,
       m.is_from_me, m.text, m.attributedBody
FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
JOIN chat c ON cmj.chat_id = c.ROWID
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE c.chat_identifier LIKE ? OR IFNULL(h.id,'') LIKE ?
ORDER BY m.date ASC
''', ('%' + needle + '%', '%' + needle + '%')).fetchall()

if not rows:
    print(json.dumps({'error': 'no_match', 'handle': needle}))
    raise SystemExit(0)

chat_id = rows[-1]['chat_identifier'] or rows[-1]['handle']
messages = []
for r in rows:
    messages.append({
        'dt': r['dt'],
        'from_me': bool(r['is_from_me']),
        'body': body(r),
    })
print(json.dumps({'chat_identifier': chat_id, 'messages': messages, 'count': len(messages)}))
`;

const LIST_CHATS_PY = `
import sqlite3, json, sys
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 25
db = __import__('pathlib').Path.home() / 'Library/Messages/chat.db'
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
SELECT c.chat_identifier,
       datetime(MAX(m.date)/1000000000 + 978307200, 'unixepoch', 'localtime') last_dt,
       COUNT(m.ROWID) msg_count
FROM chat c
JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
JOIN message m ON cmj.message_id = m.ROWID
GROUP BY c.chat_identifier
ORDER BY MAX(m.date) DESC
LIMIT ?
''', (limit,)).fetchall()
chats = [{'chat_identifier': r['chat_identifier'], 'last_dt': r['last_dt'], 'msg_count': r['msg_count']} for r in rows]
print(json.dumps({'chats': chats, 'count': len(chats)}))
`;

function runPython(script, args = []) {
  try {
    const out = execFileSync('python3', ['-c', script, ...args], {
      encoding: 'utf8',
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
    return JSON.parse(out);
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || String(e)).trim();
    if (msg.includes('unable to open database') || msg.includes('Operation not permitted')) {
      throw new Error(
        'Cannot read Messages chat.db. Grant Full Disk Access to Cursor (or Terminal) in System Settings → Privacy & Security.'
      );
    }
    const err = new Error(msg || 'Messages query failed');
    err.cause = e;
    throw err;
  }
}

function getThread({ handle } = {}) {
  if (!handle) throw new Error('handle is required (phone substring or email)');
  const result = runPython(THREAD_PY, [String(handle)]);
  if (result.error === 'no_match') {
    throw new Error(`No chat found matching: ${handle}`);
  }
  return result;
}

function listChats({ limit = 25 } = {}) {
  return runPython(LIST_CHATS_PY, [String(limit)]);
}

module.exports = { getThread, listChats, CHAT_DB };
