'use strict';

const { createContactAppleScript, updateContactAppleScript } = require('../runtime/applescript');
const { runContactsJxa } = require('../runtime/jxa');

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
      if (fn != null && String(fn).trim() !== '') parts.push(fn);
      if (ln != null && String(ln).trim() !== '') parts.push(ln);
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
        const n = (person.firstName() + ' ' + person.lastName()).trim().toLowerCase();
        if (n.indexOf(q) >= 0 || n === q) { p = person; return true; }
        return false;
      });
    }
    if (!p) throw new Error('Contact not found');
    JSON.stringify({
      id: p.id(),
      first_name: p.firstName(),
      last_name: p.lastName(),
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

module.exports = { searchContacts, getContact, createContact, updateContact };
