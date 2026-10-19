import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import shared from './shared-context.cjs';

export const name = 'shared-agent-context';
export const inject = ['systemPrompt'];

export function apply(ctx, config = {}) {
  const localFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config.local.json');
  const local = fs.existsSync(localFile) ? JSON.parse(fs.readFileSync(localFile, 'utf8')) : {};
  ctx.systemPrompt.context({
    name: 'shared-agent-context', order: 220, required: true, interpolate: false,
    text({ agent } = {}) {
      const result = shared.readContext({
        root: config.sharedRoot || process.env.AGENT_SHARED_ROOT || local.sharedRoot,
        cwd: agent?.session?.header?.cwd || process.cwd(),
        sessionId: agent?.session?.id || 'unbound',
        client: 'DSH', includeRulesAlways: true,
      });
      return result.text;
    },
  });
}
