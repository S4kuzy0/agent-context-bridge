'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { readContext, recentHandoff } = require('../src/shared-context.cjs');

const testRoot = path.resolve(__dirname, '../work/tests');
fs.mkdirSync(testRoot, { recursive: true });
function fixture() {
  const base = fs.mkdtempSync(path.join(testRoot, 'context-'));
  const root = path.join(base, 'shared');
  const cwd = path.join(base, 'project');
  fs.mkdirSync(root); fs.mkdirSync(cwd); fs.mkdirSync(path.join(cwd, '.git'));
  fs.writeFileSync(path.join(root, 'RULES.md'), 'Shared rules: preserve user work.');
  fs.writeFileSync(path.join(root, 'HANDOFF.md'), '# Handoff\n\n## 2026-10-19 12:00 | DSH | Fixture\nCurrent handoff.\n');
  return { root, cwd, now: new Date('2026-10-19T04:00:00Z') };
}

test('independent clients see each other\'s actual rule, handoff, and project memory edits', () => {
  const f = fixture();
  readContext({ ...f, client: 'Codex', sessionId: 'codex' });
  fs.writeFileSync(path.join(f.root, 'RULES.md'), 'DSH changed this rule.');
  fs.appendFileSync(path.join(f.root, 'HANDOFF.md'), '\n## 2026-10-19 12:01 | DSH | Work\nVerified result.\n');
  fs.writeFileSync(path.join(f.cwd, 'MEMORY.md'), 'Confirmed project decision from DSH.');
  const codex = readContext({ ...f, client: 'Codex', sessionId: 'codex' });
  assert.match(codex.text, /DSH changed this rule/);
  assert.match(codex.text, /Verified result/);
  assert.match(codex.text, /Confirmed project decision/);
  fs.writeFileSync(path.join(f.cwd, 'MEMORY.md'), 'Codex added a verified conclusion.');
  const dsh = readContext({ ...f, client: 'DSH', sessionId: 'dsh' });
  assert.match(dsh.text, /Codex added a verified conclusion/);
  assert.notEqual(dsh.statePath, codex.statePath);
});

test('skill script edits and removals are visible even when SKILL.md is unchanged', () => {
  const f = fixture(); const skill = path.join(f.root, 'skills/demo');
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: demo\ndescription: demo\n---\n');
  fs.writeFileSync(path.join(skill, 'script.cjs'), 'first');
  readContext({ ...f, client: 'Codex' });
  fs.writeFileSync(path.join(skill, 'script.cjs'), 'second');
  assert.deepEqual(readContext({ ...f, client: 'Codex' }).changedSkills, ['demo']);
  fs.renameSync(path.join(skill, 'SKILL.md'), path.join(skill, 'disabled.md'));
  assert.deepEqual(readContext({ ...f, client: 'Codex' }).removedSkills, ['demo']);
});

test('changed large documents stay pending and are never silently truncated', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.cwd, 'MEMORY.md'), 'A long project memory. '.repeat(500));
  const first = readContext({ ...f, maxChars: 500 });
  const second = readContext({ ...f, maxChars: 500 });
  assert.ok(first.deferred.includes(path.join(f.cwd, 'MEMORY.md')));
  assert.ok(second.deferred.includes(path.join(f.cwd, 'MEMORY.md')));
  assert.match(second.text, /Read this file completely/);
});

test('nested workspaces use the same project memory without importing sibling projects', () => {
  const f = fixture(); const nested = path.join(f.cwd, 'src'); fs.mkdirSync(nested);
  fs.writeFileSync(path.join(f.cwd, 'MEMORY.md'), 'Root memory.');
  fs.mkdirSync(path.join(f.root, 'unrelated'));
  fs.writeFileSync(path.join(f.root, 'unrelated/MEMORY.md'), 'Unrelated secret text.');
  const result = readContext({ ...f, cwd: nested });
  assert.equal(result.state.projectRoot, f.cwd);
  assert.match(result.text, /Root memory/);
  assert.doesNotMatch(result.text, /Unrelated secret text/);
});

test('handoff filtering uses Beijing dates and retains the last seven days', () => {
  const text = '# Log\n## 2026-10-11 12:00 | DSH\nOld.\n## 2026-10-12 12:00 | Codex\nBoundary.\n## 2026-10-19 01:00 | DSH\nNew.\n';
  const result = recentHandoff(text, new Date('2026-10-18T17:00:00Z'));
  assert.doesNotMatch(result, /Old/); assert.match(result, /Boundary/); assert.match(result, /New/);
});

test('missing shared rules fail clearly instead of using remembered content', () => {
  const f = fixture();
  fs.renameSync(path.join(f.root, 'RULES.md'), path.join(f.root, 'RULES.original.md'));
  assert.throws(() => readContext(f), /ENOENT/);
});

test('the Codex adapter emits an explicit blocking result when rules are unreadable', () => {
  const f = fixture();
  fs.renameSync(path.join(f.root, 'RULES.md'), path.join(f.root, 'RULES.original.md'));
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/codex-hook.cjs')], {
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'adapter-test', cwd: f.cwd }),
    encoding: 'utf8', env: { ...process.env, AGENT_SHARED_ROOT: f.root },
  });
  const output = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(output.decision, 'block');
  assert.equal(output.continue, false);
  assert.match(output.systemMessage, /Shared context error/);
});

test('the DSH plugin re-reads files on every actual context assembly', async () => {
  const f = fixture(); let provider;
  const { apply } = await import(pathToFileURL(path.resolve(__dirname, '../src/dsh-plugin.mjs')));
  apply({ systemPrompt: { context(value) { provider = value; } } }, { sharedRoot: f.root });
  const request = { agent: { session: { id: 'dsh-live', header: { cwd: f.cwd } } } };
  assert.match(provider.text(request), /Shared rules/);
  fs.writeFileSync(path.join(f.root, 'RULES.md'), 'Updated between requests.');
  assert.match(provider.text(request), /Updated between requests/);
  assert.equal(provider.required, true);
});
