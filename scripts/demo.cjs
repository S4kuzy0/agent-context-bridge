'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readContext } = require('../src/shared-context.cjs');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const demo = fs.mkdtempSync(path.join(root, 'work', 'demo-'));
for (const name of ['shared', 'project']) {
  fs.cpSync(path.join(root, 'examples', name), path.join(demo, name), { recursive: true });
}
// A local fixture marker makes this example independent of the enclosing Git checkout.
fs.mkdirSync(path.join(demo, 'project', '.git'));
const result = readContext({ root: path.join(demo, 'shared'), cwd: path.join(demo, 'project'),
  client: 'Demo', sessionId: 'example', record: false });
process.stdout.write(result.text + '\n');
