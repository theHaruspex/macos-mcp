#!/usr/bin/env node
'use strict';

const { createMcpServer } = require('../src/mcp/server');
const { runStdioServer } = require('../src/mcp/transport');
const { buildTools } = require('../src/mcp/tools');
const pkg = require('../package.json');

function main() {
  const tools = buildTools();
  const server = createMcpServer({
    tools,
    serverInfo: { name: 'macos-mcp', version: pkg.version },
  });
  process.stderr.write(
    `[macos-mcp] ready; ${tools.length} tools; macOS only (v${pkg.version})\n`
  );
  runStdioServer({ server }).then(() => process.exit(0));
}

main();
