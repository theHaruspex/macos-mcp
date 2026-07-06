'use strict';

const {
  createContactAppleScript,
  updateContactAppleScript,
  deleteContactAppleScript,
} = require('../runtime/applescript');
const { runContactsJxa } = require('../runtime/jxa');
const { parseContactsCsv } = require('./csv');

function listContacts({ missing_email = false, limit = 100 } = {}) {
  return runContactsJxa(
    `
    const out = [];
    const max = Math.min(Math.max(1, args.limit || 100), 500);
    Contacts.people().some(function (p) {
      const emails = p.emails().map(function (e) { return e.value(); });
      if (args.missing_email && emails.length > 0) return false;
      const parts = [];
      const fn = p.firstName();
      const ln = p.lastName();
      if (fn != null && String(fn).trim() !== '') parts.push(String(fn).trim());
      if (ln != null && String(ln).trim() !== '') parts.push(String(ln).trim());
      out.push({
        id: p.id(),
        name: parts.join(' '),
        first_name: fn != null ? String(fn) : '',
        last_name: ln != null ? String(ln) : '',
        emails: emails,
        phones: p.phones().map(function (ph) { return ph.value(); }),
        organization: p.organization() || '',
      });
      return out.length >= max;
    });
    JSON.stringify({ contacts: out, count: out.length, missing_email: !!args.missing_email });
  `,
    { missing_email: !!missing_email, limit }
  );
}

function searchContacts({ query } = {}) {
  if (!query) throw new Error('query is required');
  return runContactsJxa(
    `
    const q = String(args.query).toLowerCase();
    const out = [];
    Contacts.people().forEach(function (p) {
      const parts = [];
      const fn = p.firstName();
      const ln = p.lastName();
      if (fn != null && String(fn).trim() !== '') parts.push(String(fn).trim());
      if (ln != null && String(ln).trim() !== '') parts.push(String(ln).trim());
      const name = parts.join(' ');
      const emails = p.emails().map(function (e) { return e.value(); });
      const phones = p.phones().map(function (ph) { return ph.value(); });
      const hay = (name + ' ' + emails.join(' ') + ' ' + phones.join(' ')).toLowerCase();
      if (hay.indexOf(q) >= 0) {
        out.push({ id: p.id(), name: name, emails: emails, phones: phones });
      }
    });
    JSON.stringify({ contacts: out, count: out.length, query: args.query });
  `,
    { query }
  );
}

function findContactsByEmail(email) {
  if (!email) throw new Error('email is required');
  return runContactsJxa(
    `
    const q = String(args.email).toLowerCase();
    const out = [];
    Contacts.people().forEach(function (p) {
      p.emails().forEach(function (e) {
        if (String(e.value()).toLowerCase() === q) {
          const parts = [];
          const fn = p.firstName();
          const ln = p.lastName();
          if (fn != null && String(fn).trim() !== '') parts.push(String(fn).trim());
          if (ln != null && String(ln).trim() !== '') parts.push(String(ln).trim());
          out.push({
            id: p.id(),
            name: parts.join(' '),
            first_name: fn != null ? String(fn) : '',
            last_name: ln != null ? String(ln) : '',
            emails: p.emails().map(function (em) { return em.value(); }),
            phones: p.phones().map(function (ph) { return ph.value(); }),
            organization: p.organization() || '',
          });
        }
      });
    });
    JSON.stringify({ contacts: out, count: out.length, email: args.email });
  `,
    { email }
  );
}

function getContact({ contact_id, name } = {}) {
  if (contact_id == null && !name) throw new Error('contact_id or name is required');
  return runContactsJxa(
    `
    let p = null;
    if (args.contact_id != null) {
      const hits = Contacts.people.whose({ id: args.contact_id });
      if (hits.length) p = hits[0];
    }
    if (!p && args.name) {
      const q = String(args.name).toLowerCase();
      Contacts.people().some(function (person) {
        const parts = [];
        const fn = person.firstName();
        const ln = person.lastName();
        if (fn != null && String(fn).trim() !== '') parts.push(String(fn).trim());
        if (ln != null && String(ln).trim() !== '') parts.push(String(ln).trim());
        const n = parts.join(' ').toLowerCase();
        if (n.indexOf(q) >= 0 || n === q) { p = person; return true; }
        return false;
      });
    }
    if (!p) throw new Error('Contact not found');
    const fn = p.firstName();
    const ln = p.lastName();
    JSON.stringify({
      id: p.id(),
      first_name: fn != null ? String(fn) : '',
      last_name: ln != null ? String(ln) : '',
      emails: p.emails().map(function (e) { return e.value(); }),
      phones: p.phones().map(function (ph) { return ph.value(); }),
      organization: p.organization() || '',
      note: p.note() || '',
    });
  `,
    { contact_id: contact_id ?? null, name: name || null }
  );
}

function createContact({ first_name, last_name, email, phone, organization } = {}) {
  return createContactAppleScript({ first_name, last_name, email, phone, organization });
}

function updateContact({ contact_id, first_name, last_name, email, phone, organization } = {}) {
  return updateContactAppleScript({
    contact_id,
    first_name,
    last_name,
    email,
    phone,
    organization,
  });
}

function deleteContact({ contact_id } = {}) {
  return deleteContactAppleScript({ contact_id });
}

function namesMatch(a, b) {
  const af = String(a.first_name || '').trim().toLowerCase();
  const al = String(a.last_name || '').trim().toLowerCase();
  const bf = String(b.first_name || '').trim().toLowerCase();
  const bl = String(b.last_name || '').trim().toLowerCase();
  return af === bf && al === bl;
}

function importContactsCsv({ csv_path, organization = 'eCustom Solutions', dedupe = true } = {}) {
  if (!csv_path) throw new Error('csv_path is required');
  const rows = parseContactsCsv(csv_path);
  const created = [];
  const updated = [];
  const deleted = [];

  for (const row of rows) {
    const org = row.organization || organization;
    const matches = findContactsByEmail(row.email).contacts || [];

    if (matches.length === 0) {
      const result = createContact({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        organization: org,
      });
      created.push({ ...row, organization: org, id: result.id });
      continue;
    }

    const [primary, ...extras] = matches;
    const result = updateContact({
      contact_id: primary.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      organization: org,
    });
    updated.push({ ...row, organization: org, id: result.id });

    for (const extra of extras) {
      deleteContact({ contact_id: extra.id });
      deleted.push({ id: extra.id, name: extra.name, reason: 'duplicate_email' });
    }
  }

  if (dedupe) {
    const orphans = listContacts({ missing_email: true, limit: 500 }).contacts || [];
    for (const orphan of orphans) {
      const matched = rows.some((row) => namesMatch(orphan, row));
      if (matched) {
        deleteContact({ contact_id: orphan.id });
        deleted.push({ id: orphan.id, name: orphan.name, reason: 'name_without_email' });
      }
    }
  }

  return {
    csv_path,
    rows_in_csv: rows.length,
    created,
    updated,
    deleted,
    counts: {
      created: created.length,
      updated: updated.length,
      deleted: deleted.length,
    },
  };
}

module.exports = {
  listContacts,
  searchContacts,
  findContactsByEmail,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  importContactsCsv,
};
