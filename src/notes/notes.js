'use strict';

const { runNotesJxa } = require('../runtime/jxa');

function listFolders() {
  return runNotesJxa(`
    const out = Notes.folders().map(function (f) {
      return { name: f.name() };
    });
    JSON.stringify({ folders: out, count: out.length });
  `);
}

function listNotes({ folder, limit = 50 } = {}) {
  return runNotesJxa(
    `
    const folders = args.folder
      ? (function () {
          const hit = Notes.folders.whose({ name: args.folder })[0];
          if (!hit) throw new Error('Folder not found: ' + args.folder);
          return [hit];
        })()
      : Notes.folders();
    const out = [];
    folders.forEach(function (f) {
      f.notes().slice(0, args.limit - out.length).forEach(function (n) {
        if (out.length >= args.limit) return;
        out.push({
          id: n.id(),
          name: n.name(),
          folder: f.name(),
          modified: n.modificationDate() ? n.modificationDate().toISOString() : null,
        });
      });
    });
    JSON.stringify({ notes: out, count: out.length });
  `,
    { folder: folder || null, limit }
  );
}

function searchNotes({ query, folder } = {}) {
  if (!query) throw new Error('query is required');
  return runNotesJxa(
    `
    const q = String(args.query).toLowerCase();
    const folders = args.folder
      ? (function () {
          const hit = Notes.folders.whose({ name: args.folder })[0];
          if (!hit) throw new Error('Folder not found: ' + args.folder);
          return [hit];
        })()
      : Notes.folders();
    const out = [];
    folders.forEach(function (f) {
      f.notes().forEach(function (n) {
        let body = '';
        try { body = n.plaintext(); } catch (_) {
          try { body = n.body(); } catch (_2) { body = ''; }
        }
        const hay = (n.name() + ' ' + body).toLowerCase();
        if (hay.indexOf(q) >= 0) {
          out.push({
            id: n.id(),
            name: n.name(),
            folder: f.name(),
            modified: n.modificationDate() ? n.modificationDate().toISOString() : null,
          });
        }
      });
    });
    JSON.stringify({ notes: out, count: out.length, query: args.query });
  `,
    { query, folder: folder || null }
  );
}

function getNote({ note_id, name, folder } = {}) {
  if (note_id == null && !name) throw new Error('note_id or name is required');
  return runNotesJxa(
    `
    const folders = args.folder
      ? (function () {
          const hit = Notes.folders.whose({ name: args.folder })[0];
          if (!hit) throw new Error('Folder not found: ' + args.folder);
          return [hit];
        })()
      : Notes.folders();
    let found = null;
    let folderName = null;
    folders.some(function (f) {
      return f.notes().some(function (n) {
        if (args.note_id != null && n.id() === args.note_id) { found = n; folderName = f.name(); return true; }
        if (args.name && n.name() === args.name) { found = n; folderName = f.name(); return true; }
        return false;
      });
    });
    if (!found) throw new Error('Note not found');
    let body = null;
    let body_unavailable = false;
    try { body = found.plaintext(); } catch (_) {
      try { body = found.body(); } catch (_2) { body_unavailable = true; }
    }
    JSON.stringify({
      id: found.id(),
      name: found.name(),
      folder: folderName,
      body: body,
      body_unavailable: body_unavailable,
      modified: found.modificationDate() ? found.modificationDate().toISOString() : null,
    });
  `,
    { note_id: note_id ?? null, name: name || null, folder: folder || null }
  );
}

function createNote({ folder, name, body } = {}) {
  if (!folder) throw new Error('folder is required');
  if (!name) throw new Error('name is required');
  return runNotesJxa(
    `
    const f = Notes.folders.whose({ name: args.folder })[0];
    if (!f) throw new Error('Folder not found: ' + args.folder);
    const props = { name: args.name };
    if (args.body) props.body = args.body;
    const n = f.make({ new: 'note', withProperties: props });
    JSON.stringify({ id: n.id(), name: n.name(), folder: args.folder });
  `,
    { folder, name, body: body || '' }
  );
}

function appendNote({ note_id, name, folder, text } = {}) {
  if (note_id == null && !name) throw new Error('note_id or name is required');
  if (!text) throw new Error('text is required');
  return runNotesJxa(
    `
    const folders = args.folder
      ? (function () {
          const hit = Notes.folders.whose({ name: args.folder })[0];
          if (!hit) throw new Error('Folder not found: ' + args.folder);
          return [hit];
        })()
      : Notes.folders();
    let found = null;
    folders.some(function (f) {
      return f.notes().some(function (n) {
        if (args.note_id != null && n.id() === args.note_id) { found = n; return true; }
        if (args.name && n.name() === args.name) { found = n; return true; }
        return false;
      });
    });
    if (!found) throw new Error('Note not found');
    let existing = '';
    try { existing = found.plaintext(); } catch (_) {
      try { existing = found.body(); } catch (_2) { existing = ''; }
    }
    found.body = existing + args.text;
    JSON.stringify({ id: found.id(), name: found.name(), appended: true });
  `,
    { note_id: note_id ?? null, name: name || null, folder: folder || null, text }
  );
}

module.exports = {
  listFolders,
  listNotes,
  searchNotes,
  getNote,
  createNote,
  appendNote,
};
