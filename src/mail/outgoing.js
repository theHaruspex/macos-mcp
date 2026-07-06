'use strict';

/** Replace dash-like prose separators with commas. Preserves newlines. */
function sanitizeOutgoingEmail(text) {
  return String(text || '')
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Strip leading/trailing line breaks before handing text to Mail.app. */
function normalizeDraftBody(text) {
  return String(text || '')
    .replace(/^[\n\r\u2028\u2029]+/, '')
    .replace(/[\n\r\u2028\u2029]+$/, '');
}

module.exports = { sanitizeOutgoingEmail, normalizeDraftBody };
