'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SIG_ROOT = path.resolve(__dirname, '../../signatures');
const MANIFEST_PATH = path.join(SIG_ROOT, 'manifest.json');

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function normalizeSender(sender) {
  return String(sender || '').trim().toLowerCase();
}

function resolveSignatureFile(sender, variant = 'default') {
  const key = normalizeSender(sender);
  if (!key) return null;

  const manifest = loadManifest();
  const entry = manifest[key];
  if (entry) {
    const file = entry[variant] || entry.default;
    if (file) return path.join(SIG_ROOT, file);
  }

  const direct = path.join(SIG_ROOT, `${key}.txt`);
  if (variant === 'default' && fs.existsSync(direct)) return direct;

  if (variant !== 'default') {
    const variantFile = path.join(SIG_ROOT, `${key}-${variant}.txt`);
    if (fs.existsSync(variantFile)) return variantFile;
  }

  return null;
}

function loadSignatureText(sender, variant = 'default') {
  const file = resolveSignatureFile(sender, variant);
  if (!file || !fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').trim();
}

function bodyHasSignature(body, signatureText) {
  const bodyNorm = String(body || '').trim();
  const sigNorm = String(signatureText || '').trim();
  if (!bodyNorm || !sigNorm) return false;
  if (bodyNorm.includes(sigNorm)) return true;
  const firstLine = sigNorm.split('\n')[0].trim();
  return firstLine.length > 0 && bodyNorm.includes(firstLine);
}

function appendSignature({ body = '', sender = null, signature = 'default' } = {}) {
  if (!sender || signature === 'none') {
    return { body, signature_appended: false, signature_variant: signature || null };
  }

  const sigText = loadSignatureText(sender, signature === 'default' ? 'default' : signature);
  if (!sigText) {
    return { body, signature_appended: false, signature_variant: signature, signature_missing: true };
  }

  if (bodyHasSignature(body, sigText)) {
    return { body, signature_appended: false, signature_variant: signature, signature_already_present: true };
  }

  const trimmed = String(body || '').replace(/^\s+/, '').replace(/\s+$/, '');
  const sep = trimmed ? '\n\n' : '';
  return {
    body: `${trimmed}${sep}${sigText}\n`,
    signature_appended: true,
    signature_variant: signature,
  };
}

module.exports = {
  SIG_ROOT,
  MANIFEST_PATH,
  loadManifest,
  loadSignatureText,
  appendSignature,
};
