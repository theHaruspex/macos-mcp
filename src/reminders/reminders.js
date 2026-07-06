'use strict';

const { runRemindersJxa } = require('../runtime/jxa');

const RESOLVE_LISTS = `
function resolveLists(listName) {
  if (listName) {
    const hit = Reminders.lists.whose({ name: listName })[0];
    if (!hit) throw new Error('List not found: ' + listName);
    return [hit];
  }
  return Reminders.lists();
}
function reminderMatches(r, args) {
  if (args.reminder_id != null && String(r.id()) === String(args.reminder_id)) return true;
  if (args.name && r.name() === args.name) return true;
  return false;
}
`;

function listLists() {
  return runRemindersJxa(`
    const out = Reminders.lists().map(function (l) {
      return { name: l.name() };
    });
    JSON.stringify({ lists: out, count: out.length });
  `);
}

function listReminders({ list, completed, due_before, due_after } = {}) {
  if (!list) throw new Error('list is required');
  return runRemindersJxa(
    `
    ${RESOLVE_LISTS}
    const lst = Reminders.lists.whose({ name: args.list })[0];
    if (!lst) throw new Error('List not found: ' + args.list);
    let items;
    if (args.completed === true) items = lst.reminders.whose({ completed: true });
    else if (args.completed === false) items = lst.reminders.whose({ completed: false });
    else items = lst.reminders();
    const dueBefore = args.due_before ? new Date(args.due_before) : null;
    const dueAfter = args.due_after ? new Date(args.due_after) : null;
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      const due = r.dueDate();
      if (dueBefore && due && due > dueBefore) continue;
      if (dueAfter && due && due < dueAfter) continue;
      out.push({
        id: String(r.id()),
        name: r.name(),
        completed: r.completed(),
        due: due ? due.toISOString() : null,
        notes: r.body() || '',
        list: args.list,
        priority: r.priority(),
      });
    }
    JSON.stringify({ reminders: out, count: out.length });
  `,
    {
      list,
      completed: completed ?? null,
      due_before: due_before || null,
      due_after: due_after || null,
    }
  );
}

function searchReminders({ query, list } = {}) {
  if (!query) throw new Error('query is required');
  return runRemindersJxa(
    `
    ${RESOLVE_LISTS}
    const q = String(args.query).toLowerCase();
    const lists = resolveLists(args.list);
    const out = [];
    for (let i = 0; i < lists.length; i++) {
      const lst = lists[i];
      const items = lst.reminders();
      for (let j = 0; j < items.length; j++) {
        const r = items[j];
        const hay = (r.name() + ' ' + (r.body() || '')).toLowerCase();
        if (hay.indexOf(q) >= 0) {
          const due = r.dueDate();
          out.push({
            id: String(r.id()),
            name: r.name(),
            completed: r.completed(),
            due: due ? due.toISOString() : null,
            notes: r.body() || '',
            list: lst.name(),
          });
        }
      }
    }
    JSON.stringify({ reminders: out, count: out.length, query: args.query });
  `,
    { query, list: list || null }
  );
}

function createReminder({ list, name, due, notes, priority } = {}) {
  if (!list) throw new Error('list is required');
  if (!name) throw new Error('name is required');
  return runRemindersJxa(
    `
    const lst = Reminders.lists.whose({ name: args.list })[0];
    if (!lst) throw new Error('List not found: ' + args.list);
    const props = { name: args.name };
    if (args.due) props.dueDate = new Date(args.due);
    if (args.notes) props.body = args.notes;
    if (args.priority != null) props.priority = args.priority;
    const r = lst.make({ new: 'reminder', withProperties: props });
    const dueDate = r.dueDate();
    JSON.stringify({
      id: String(r.id()),
      name: r.name(),
      due: dueDate ? dueDate.toISOString() : null,
      list: args.list,
    });
  `,
    { list, name, due: due || null, notes: notes || null, priority: priority ?? null }
  );
}

function completeReminder({ reminder_id, name, list } = {}) {
  if (reminder_id == null && !name) throw new Error('reminder_id or name is required');
  return runRemindersJxa(
    `
    ${RESOLVE_LISTS}
    const lists = resolveLists(args.list);
    let found = null;
    for (let i = 0; i < lists.length; i++) {
      const lst = lists[i];
      const items = lst.reminders();
      for (let j = 0; j < items.length; j++) {
        if (reminderMatches(items[j], args)) { found = items[j]; break; }
      }
      if (found) break;
    }
    if (!found) throw new Error('Reminder not found');
    found.completed = true;
    JSON.stringify({ id: String(found.id()), name: found.name(), completed: true });
  `,
    { reminder_id: reminder_id ?? null, name: name || null, list: list || null }
  );
}

function deleteReminder({ reminder_id, name, list } = {}) {
  if (reminder_id == null && !name) throw new Error('reminder_id or name is required');
  return runRemindersJxa(
    `
    ${RESOLVE_LISTS}
    const lists = resolveLists(args.list);
    let found = null;
    for (let i = 0; i < lists.length; i++) {
      const lst = lists[i];
      const items = lst.reminders();
      for (let j = 0; j < items.length; j++) {
        if (reminderMatches(items[j], args)) { found = items[j]; break; }
      }
      if (found) break;
    }
    if (!found) throw new Error('Reminder not found');
    const n = found.name();
    found.delete();
    JSON.stringify({ deleted: true, name: n });
  `,
    { reminder_id: reminder_id ?? null, name: name || null, list: list || null }
  );
}

module.exports = {
  listLists,
  listReminders,
  searchReminders,
  createReminder,
  completeReminder,
  deleteReminder,
};
