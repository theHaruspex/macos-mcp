'use strict';

const { runCalendarJxa } = require('../runtime/jxa');
const {
  createCalendarEventAppleScript,
  updateCalendarEventAppleScript,
  getCalendarEventAppleScript,
  deleteCalendarEventAppleScript,
} = require('../runtime/applescript');

function listCalendars() {
  return runCalendarJxa(`
    const out = Calendar.calendars().map(function (c) {
      return { name: c.name(), writable: c.writable() };
    });
    JSON.stringify({ calendars: out, count: out.length });
  `);
}

function listEvents({ start, end, calendar } = {}) {
  if (!start || !end) throw new Error('start and end are required (ISO 8601 dates)');
  return runCalendarJxa(
    `
    const rangeStart = new Date(args.start);
    const rangeEnd = new Date(args.end);
    if (isNaN(rangeStart) || isNaN(rangeEnd)) throw new Error('Invalid start or end date');
    const calList = (function () {
      if (args.calendar) {
        const hit = Calendar.calendars.whose({ name: args.calendar })[0];
        if (!hit) throw new Error('Calendar not found: ' + args.calendar);
        return [hit];
      }
      return Calendar.calendars();
    })();
    const events = [];
    calList.forEach(function (cal) {
      let evs;
      try {
        evs = cal.events.whose({
          startDate: { _greaterThanEquals: rangeStart, _lessThan: rangeEnd },
        });
      } catch (_) {
        evs = [];
      }
      for (let j = 0; j < evs.length; j++) {
        try {
          const ev = evs[j];
          const s = ev.startDate();
          let notes = '';
          try { notes = ev.description() || ''; } catch (_n) {}
          events.push({
            uid: String(ev.uid()),
            summary: ev.summary(),
            start: s.toISOString(),
            end: ev.endDate().toISOString(),
            location: ev.location() || '',
            calendar: cal.name(),
            notes: notes,
          });
        } catch (_ev) {}
      }
    });
    events.sort(function (a, b) { return a.start.localeCompare(b.start); });
    JSON.stringify({ events: events, count: events.length });
  `,
    { start, end, calendar: calendar || null }
  );
}

function searchEvents({ query, start, end, calendar } = {}) {
  if (!query) throw new Error('query is required');
  const rangeStart = start ? new Date(start) : new Date(0);
  const rangeEnd = end ? new Date(end) : new Date('2099-12-31');
  return runCalendarJxa(
    `
    const q = String(args.query).toLowerCase();
    const rangeStart = new Date(args.rangeStart);
    const rangeEnd = new Date(args.rangeEnd);
    const calList = (function () {
      if (args.calendar) {
        const hit = Calendar.calendars.whose({ name: args.calendar })[0];
        if (!hit) throw new Error('Calendar not found: ' + args.calendar);
        return [hit];
      }
      return Calendar.calendars();
    })();
    const events = [];
    calList.forEach(function (cal) {
      let evs;
      try {
        evs = cal.events.whose({
          startDate: { _greaterThanEquals: rangeStart, _lessThan: rangeEnd },
        });
      } catch (_) {
        evs = [];
      }
      for (let j = 0; j < evs.length; j++) {
        try {
          const ev = evs[j];
          const s = ev.startDate();
          const hay = (ev.summary() + ' ' + (ev.location() || '')).toLowerCase();
          if (hay.indexOf(q) >= 0) {
            events.push({
              uid: String(ev.uid()),
              summary: ev.summary(),
              start: s.toISOString(),
              end: ev.endDate().toISOString(),
              location: ev.location() || '',
              calendar: cal.name(),
            });
          }
        } catch (_ev) {}
      }
    });
    JSON.stringify({ events: events, count: events.length, query: args.query });
  `,
    { query, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString(), calendar: calendar || null }
  );
}

function getEvent({ uid, calendar } = {}) {
  if (!uid) throw new Error('uid is required');
  return getCalendarEventAppleScript({ uid, calendar: calendar || null });
}

function createEvent({ calendar, summary, start, end, location, notes, alarms } = {}) {
  if (!calendar) throw new Error('calendar is required');
  if (!summary) throw new Error('summary is required');
  if (!start || !end) throw new Error('start and end are required');
  const created = createCalendarEventAppleScript({ calendar, summary, start, end, location, notes });
  if (alarms && alarms.length) {
    runCalendarJxa(
      `
      const cal = Calendar.calendars.whose({ name: args.calendar })[0];
      const ev = cal.events.whose({ uid: args.uid })[0];
      if (!ev) throw new Error('Event not found after create');
      args.alarms.forEach(function (mins) {
        ev.make({ new: 'alarm', withProperties: { triggerInterval: -Math.abs(mins) } });
      });
      JSON.stringify({ ok: true });
    `,
      { calendar, uid: created.uid, alarms }
    );
  }
  return created;
}

function updateEvent({ uid, calendar, summary, start, end, location, notes } = {}) {
  if (!uid) throw new Error('uid is required');
  updateCalendarEventAppleScript({ calendar, uid, summary, start, end, location, notes });
  return getCalendarEventAppleScript({ uid, calendar: calendar || null });
}

function deleteEvent({ uid, calendar } = {}) {
  if (!uid) throw new Error('uid is required');
  return deleteCalendarEventAppleScript({ calendar, uid });
}

module.exports = {
  listCalendars,
  listEvents,
  searchEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
};
