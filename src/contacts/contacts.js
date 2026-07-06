'use strict';

const { runContactsJxa } = require('../runtime/jxa');

function searchContacts({ query } = {}) {
  if (!query) throw new Error('query is required');
  return runContactsJxa(
    `
    const q = String(args.query).toLowerCase();
    const out = [];
    Contacts.people().forEach(function (p) {
      const name = (p.firstName() + ' ' + p.lastName()).trim();
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
  if (!first_name && !last_name) throw new Error('first_name or last_name is required');
  return runContactsJxa(
    `
    const props = {};
    if (args.first_name) props.firstName = args.first_name;
    if (args.last_name) props.lastName = args.last_name;
    if (args.organization) props.organization = args.organization;
    const p = Contacts.make({ new: 'person', withProperties: props });
    if (args.email) {
      p.make({ new: 'email', withProperties: { value: args.email, label: 'home' } });
    }
    if (args.phone) {
      p.make({ new: 'phone', withProperties: { value: args.phone, label: 'mobile' } });
    }
    JSON.stringify({
      id: p.id(),
      first_name: p.firstName(),
      last_name: p.lastName(),
    });
  `,
    {
      first_name: first_name || null,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      organization: organization || null,
    }
  );
}

function updateContact({ contact_id, first_name, last_name, email, phone, organization } = {}) {
  if (contact_id == null) throw new Error('contact_id is required');
  return runContactsJxa(
    `
    const hits = Contacts.people.whose({ id: args.contact_id });
    if (!hits.length) throw new Error('Contact not found');
    const p = hits[0];
    if (args.first_name != null) p.firstName = args.first_name;
    if (args.last_name != null) p.lastName = args.last_name;
    if (args.organization != null) p.organization = args.organization;
    if (args.email) {
      const existing = p.emails();
      if (existing.length) existing[0].value = args.email;
      else p.make({ new: 'email', withProperties: { value: args.email, label: 'home' } });
    }
    if (args.phone) {
      const existing = p.phones();
      if (existing.length) existing[0].value = args.phone;
      else p.make({ new: 'phone', withProperties: { value: args.phone, label: 'mobile' } });
    }
    JSON.stringify({
      id: p.id(),
      first_name: p.firstName(),
      last_name: p.lastName(),
    });
  `,
    {
      contact_id,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      email: email || null,
      phone: phone || null,
      organization: organization ?? null,
    }
  );
}

module.exports = { searchContacts, getContact, createContact, updateContact };
