'use strict';

function runStdioServer({ server, input = process.stdin, output = process.stdout } = {}) {
  if (!server) throw new Error('server required');
  let buf = '';
  const pending = [];
  if (input.setEncoding) input.setEncoding('utf8');

  const write = (obj) => {
    output.write(JSON.stringify(obj) + '\n');
  };

  function dispatchLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (_) {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    const p = Promise.resolve()
      .then(() => server.handleMessage(msg))
      .then((resp) => {
        if (resp) write(resp);
      })
      .catch((e) => {
        const id = msg && msg.id !== undefined ? msg.id : null;
        write({
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: `Internal error: ${e && e.message ? e.message : e}` },
        });
      });
    pending.push(p);
  }

  return new Promise((resolve) => {
    input.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        dispatchLine(line);
      }
    });
    const finish = async () => {
      if (buf.length) {
        dispatchLine(buf);
        buf = '';
      }
      await Promise.allSettled(pending);
      resolve();
    };
    input.on('end', finish);
    input.on('close', finish);
  });
}

module.exports = { runStdioServer };
