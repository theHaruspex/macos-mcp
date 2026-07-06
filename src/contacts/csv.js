'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function deriveNameFromEmail(email) {
  const local = String(email).split('@')[0] || '';
  const parts = local.split('.').filter(Boolean);
  if (parts.length >= 2) {
    return { first_name: cap(parts[0]), last_name: parts.slice(1).map(cap).join(' ') };
  }
  return { first_name: cap(local), last_name: '' };
}

function parseContactsCsv(csvPath) {
  const abs = path.resolve(String(csvPath).replace(/^~(?=\/|$)/, process.env.HOME || ''));
  if (!fs.existsSync(abs)) throw new Error(`CSV not found: ${abs}`);
  const lines = fs.readFileSync(abs, 'utf8').trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV has no data rows');

  const headers = parseCsvLine(lines[0]);
  const col = (name) => {
    const idx = headers.indexOf(name);
    if (idx < 0) throw new Error(`CSV missing column: ${name}`);
    return idx;
  };
  const firstIdx = col('First Name');
  const lastIdx = col('Last Name');
  const orgIdx = headers.indexOf('Organization Name');
  const emailIdx = col('E-mail 1 - Value');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const email = (fields[emailIdx] || '').trim();
    if (!email || !email.includes('@')) continue;

    let first_name = (fields[firstIdx] || '').trim();
    let last_name = (fields[lastIdx] || '').trim();
    if (!first_name && !last_name) {
      ({ first_name, last_name } = deriveNameFromEmail(email));
    }

    const organization =
      orgIdx >= 0 ? (fields[orgIdx] || '').trim() : '';

    rows.push({ first_name, last_name, email, organization });
  }
  return rows;
}

module.exports = { parseContactsCsv, deriveNameFromEmail };
