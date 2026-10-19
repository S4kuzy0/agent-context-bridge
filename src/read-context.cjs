'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readContext } = require('./shared-context.cjs');

const localFile = path.resolve(__dirname, '../config.local.json');
const local = fs.existsSync(localFile) ? JSON.parse(fs.readFileSync(localFile, 'utf8')) : {};
const args = process.argv.slice(2);
function value(flag, fallback) { const index = args.indexOf(flag); return index < 0 ? fallback : args[index + 1]; }
try {
  const result = readContext({
    root: value('--root', process.env.AGENT_SHARED_ROOT || local.sharedRoot), cwd: value('--cwd', process.cwd()),
    client: value('--client', 'manual'),
    sessionId: value('--session', process.env.CODEX_THREAD_ID || process.env.DSH_SESSION_ID || 'manual'),
    includeRulesAlways: true, record: !args.includes('--no-record'),
  });
  process.stdout.write(args.includes('--json') ? JSON.stringify(result, null, 2) : result.text);
} catch (error) { process.stderr.write(`Shared context error: ${error.message}\n`); process.exitCode = 1; }
