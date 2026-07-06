'use strict';

const { execFileSync } = require('node:child_process');

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Run a JXA snippet against any macOS app.
 * `body` should read `args` and end with a JSON-serializable expression (usually JSON.stringify(...)).
 */
function runJxa(appName, body, args = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const script = `'use strict';
const App = Application(${JSON.stringify(appName)});
App.includeStandardAdditions = true;
const args = ${JSON.stringify(args)};
${body}
`;
  try {
    const out = execFileSync('osascript', ['-l', 'JavaScript', '-e', script], {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return out.trim();
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || String(e)).trim();
    const err = new Error(msg || 'JXA execution failed');
    err.cause = e;
    throw err;
  }
}

function parseJson(out) {
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch (_) {
    return out;
  }
}

function runJxaJson(appName, body, args, opts) {
  return parseJson(runJxa(appName, body, args, opts));
}

/** Run JXA with `App` aliased to a domain-specific name (e.g. Mail, Calendar). */
function runAppJxaJson(appName, alias, body, args, opts) {
  const prefixed = alias === 'App' ? body : `const ${alias} = App;\n${body}`;
  return runJxaJson(appName, prefixed, args, opts);
}

function runMailJxa(body, args, opts) {
  return runAppJxaJson('Mail', 'Mail', body, args, opts);
}

function runCalendarJxa(body, args, opts) {
  return runAppJxaJson('Calendar', 'Calendar', body, args, opts);
}

function runRemindersJxa(body, args, opts) {
  return runAppJxaJson('Reminders', 'Reminders', body, args, opts);
}

function runNotesJxa(body, args, opts) {
  return runAppJxaJson('Notes', 'Notes', body, args, opts);
}

function runContactsJxa(body, args, opts) {
  return runAppJxaJson('Contacts', 'Contacts', body, args, opts);
}

module.exports = {
  runJxa,
  runJxaJson,
  parseJson,
  runAppJxaJson,
  runMailJxa,
  runCalendarJxa,
  runRemindersJxa,
  runNotesJxa,
  runContactsJxa,
};
