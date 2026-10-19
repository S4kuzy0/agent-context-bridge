'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readContext } = require('./shared-context.cjs');

try {
  const raw = fs.readFileSync(0, 'utf8');
  const input = raw.trim() ? JSON.parse(raw) : {};
  const localFile = path.resolve(__dirname, '../config.local.json');
  const local = fs.existsSync(localFile) ? JSON.parse(fs.readFileSync(localFile, 'utf8')) : {};
  const result = readContext({
    root: process.env.AGENT_SHARED_ROOT || local.sharedRoot,
    client: 'Codex',
    cwd: input.cwd || process.cwd(),
    sessionId: input.session_id || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || 'manual',
    includeRulesAlways: true,
  });
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: input.hook_event_name || 'UserPromptSubmit', additionalContext: result.text,
  } }));
} catch (error) {
  process.stdout.write(JSON.stringify({ continue: false, decision: 'block', reason: error.message,
    stopReason: `Shared context could not be read. Report this failure to the user: ${error.message}`,
    systemMessage: `Shared context error: ${error.message}`,
  }));
}
