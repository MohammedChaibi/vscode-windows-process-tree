/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Produces the prebuilt binaries that ship inside the npm tarball.
 *
 * Because this addon is built against Node-API (via node-addon-api) with a pinned
 * `NAPI_VERSION`, a *single* binary per architecture is loadable by every runtime in the
 * support matrix -- Node.js 20/22/24 and every Electron release that provides Node-API 8+.
 * node-gyp-build treats `node.napi.node` as runtime-agnostic and will load it under Electron
 * too, so there is no per-ABI matrix to maintain here.
 *
 * Two deliberate choices:
 *   - Headers are pinned to the oldest supported Node.js (`HEADERS_TARGET`) rather than
 *     "whatever is newest today", so the output is reproducible and cannot pick up symbols
 *     that older supported runtimes lack.
 *   - `hardened_build=1` is set, so *published* binaries get Spectre mitigation and
 *     /ZH:SHA_256. That requires optional VS components, which is exactly why it is not the
 *     default for consumers who compile from source. See binding.gyp.
 *
 * Usage: node scripts/prebuild.js [--arch x64|arm64] [extra prebuildify args...]
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

// Oldest runtime in the support matrix (see README "Support matrix").
const HEADERS_TARGET = '20.0.0';

if (process.platform !== 'win32') {
  console.error('scripts/prebuild.js: prebuilds can only be produced on Windows.');
  process.exit(1);
}

const prebuildify = path.join(__dirname, '..', 'node_modules', 'prebuildify', 'bin.js');

// prebuildify@6 names the output after the *package* by default, which node-gyp-build only
// resolves through its "unrecognised tag matches anything" fallback. Ask for the documented
// `node.napi.node` name instead: node-gyp-build parses those tags explicitly and treats them
// as runtime-agnostic, so the same file is selected under Node.js and under Electron.
const args = ['--napi', '--name', 'node.napi', '--target', HEADERS_TARGET, ...process.argv.slice(2)];

console.log('prebuildify ' + args.join(' ') + '  (hardened_build=1, headers node@' + HEADERS_TARGET + ')');

const result = spawnSync(process.execPath, [prebuildify, ...args], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: Object.assign({}, process.env, {
    // Consumed by node-gyp -> gyp as the `hardened_build` variable (see binding.gyp).
    npm_config_hardened_build: '1'
  })
});

if (result.error) {
  console.error('scripts/prebuild.js: failed to run prebuildify:', result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
