/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * End-to-end check that an *installed* copy of the package loads its native binary and exposes
 * the documented API. Used by CI against both a freshly installed tarball and the working tree,
 * under Node.js and under Electron.
 *
 * Usage: node scripts/smoke-test.js [packageRoot]
 *
 * `packageRoot` defaults to the repo root. Set PREBUILDS_ONLY=1 to require that the binary is
 * resolved from `prebuilds/` rather than a local `build/Release`.
 */

'use strict';

const assert = require('assert');
const path = require('path');

const EXPECTED_API = [
  'getProcessTree',
  'getProcessList',
  'getSystemProcessList',
  'getProcessCpuUsage',
  'buildProcessTree',
  'filterProcessList',
  'onSessionChange',
  'stopSessionNotifications',
  'readRegistryValue',
  'findRegistryValue'
];

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const runtime = process.versions.electron ? 'electron ' + process.versions.electron : 'node ' + process.versions.node;

console.log('smoke-test: ' + runtime + ' (node-api ' + (process.versions.napi || '?') + ')');
console.log('smoke-test: package root ' + root);

const resolved = require('node-gyp-build').path(root);
console.log('ok   native binary: ' + resolved);

if (process.env.PREBUILDS_ONLY === '1') {
  assert(
    resolved.split(path.sep).includes('prebuilds'),
    'expected the binary to come from prebuilds/, got ' + resolved
  );
  console.log('ok   resolved from prebuilds/');
}

const wpt = require(root);

const missing = EXPECTED_API.filter((name) => typeof wpt[name] !== 'function');
assert.strictEqual(missing.length, 0, 'missing exports: ' + missing.join(', '));
console.log('ok   exports: ' + EXPECTED_API.join(', '));

// readRegistryValue is synchronous and returns '' when the value is absent, so calling it is
// safe regardless of the machine's registry contents.
const clientName = wpt.readRegistryValue('HKCU\\Volatile Environment', 'CLIENTNAME');
assert.strictEqual(typeof clientName, 'string');
console.log('ok   readRegistryValue -> ' + JSON.stringify(clientName));

let done = false;

wpt.getProcessTree(process.pid, (tree) => {
  assert.ok(tree, 'getProcessTree returned no tree');
  assert.strictEqual(tree.pid, process.pid);
  assert.strictEqual(typeof tree.name, 'string');
  assert.ok(Array.isArray(tree.children));
  console.log('ok   getProcessTree -> ' + tree.pid + ' ' + tree.name);

  wpt.getSystemProcessList((list) => {
    assert.ok(Array.isArray(list) && list.length > 0, 'getSystemProcessList returned nothing');
    assert.ok(list.some((p) => p.pid === process.pid), 'own pid missing from the system process list');
    console.log('ok   getSystemProcessList -> ' + list.length + ' processes');
    done = true;
    console.log('\nsmoke test passed (' + runtime + ')');
    process.exit(0);
  });
});

setTimeout(() => {
  if (!done) {
    console.error('smoke test timed out waiting for native callbacks');
    process.exit(1);
  }
}, 20000);
