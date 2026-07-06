#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.resolve(__dirname, '..', 'bin', 'macos-mcp.js');
const ENTRY = { command: 'node', args: [BIN] };

const targets = [{ name: 'Cursor', file: path.join(os.homedir(), '.cursor', 'mcp.json') }];

for (const t of targets) {
  if (!fs.existsSync(path.dirname(t.file))) continue;
  let cfg = {};
  if (fs.existsSync(t.file)) {
    cfg = JSON.parse(fs.readFileSync(t.file, 'utf8')) || {};
    fs.copyFileSync(t.file, `${t.file}.bak`);
  }
  if (!cfg.mcpServers) cfg.mcpServers = {};
  cfg.mcpServers['macos-local'] = ENTRY;
  fs.writeFileSync(t.file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log(`Wired "macos-local" into ${t.name}: ${t.file}`);
}

console.log('Restart Cursor to load macos-local MCP.');
