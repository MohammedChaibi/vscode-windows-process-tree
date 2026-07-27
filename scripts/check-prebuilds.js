/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Verifies that the prebuilds which are supposed to ship are actually present, resolvable by
 * node-gyp-build *without* falling back to a local build, and expose the full addon surface.
 *
 * Run after `npm run prebuild`, and in CI before publishing.
 *
 * Usage: node scripts/check-prebuilds.js [arch...]     (default: x64)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXPECTED_EXPORTS = [
  'getProcessList',
  'getProcessCpuUsage',
  'startSessionNotifications',
  'stopSessionNotifications',
  'readRegistryValue',
  'findRegistryValue'
];

const arches = process.argv.slice(2).length ? process.argv.slice(2) : ['x64'];
const failures = [];

for (const arch of arches) {
  const dir = path.join(ROOT, 'prebuilds', 'win32-' + arch);
  const file = path.join(dir, 'node.napi.node');

  if (!fs.existsSync(file)) {
    failures.push('missing prebuild: ' + path.relative(ROOT, file));
    continue;
  }

  const size = fs.statSync(file).size;
  console.log('ok   ' + path.relative(ROOT, file) + '  (' + Math.round(size / 1024) + ' KiB)');

  // Only the host architecture can actually be loaded in this process.
  if (arch !== process.arch) {
    console.log('skip loading win32-' + arch + ' on host arch ' + process.arch);
    continue;
  }

  // PREBUILDS_ONLY makes node-gyp-build ignore build/Release, so this proves the *prebuild*
  // is what a consumer would resolve rather than a leftover local build.
  process.env.PREBUILDS_ONLY = '1';
  let resolved;
  try {
    resolved = require('node-gyp-build').path(ROOT);
  } catch (err) {
    failures.push('node-gyp-build could not resolve a prebuild for win32-' + arch + ': ' + err.message);
    continue;
  }
  delete process.env.PREBUILDS_ONLY;

  if (path.resolve(resolved) !== path.resolve(file)) {
    failures.push('node-gyp-build resolved ' + resolved + ', expected ' + file);
    continue;
  }
  console.log('ok   node-gyp-build resolves it with PREBUILDS_ONLY=1');

  const native = require(file);
  const missing = EXPECTED_EXPORTS.filter((name) => typeof native[name] !== 'function');
  if (missing.length) {
    failures.push('prebuild win32-' + arch + ' is missing exports: ' + missing.join(', '));
    continue;
  }
  console.log('ok   exports: ' + EXPECTED_EXPORTS.join(', '));
}

if (failures.length) {
  console.error('\nprebuild check FAILED:');
  for (const f of failures) {
    console.error('  - ' + f);
  }
  process.exit(1);
}

console.log('\nprebuild check passed for: ' + arches.map((a) => 'win32-' + a).join(', '));
