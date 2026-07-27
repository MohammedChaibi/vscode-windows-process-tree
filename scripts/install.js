/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * npm `install` hook.
 *
 * The package is installable on every platform (all native APIs are documented as no-ops off
 * Windows), so there is nothing to do unless we are actually on Windows. On Windows we hand off
 * to node-gyp-build, which uses a prebuilt binary from `prebuilds/<platform>-<arch>/` when one
 * is available and only falls back to compiling with node-gyp when it is not.
 */

'use strict';

const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.log(
    '@mohammedchaibi/windows-process-tree: skipping native build on ' +
    process.platform + ' (Windows-only addon; all APIs are no-ops here).'
  );
  process.exit(0);
}

let bin;
try {
  bin = require.resolve('node-gyp-build/bin.js');
} catch (err) {
  // Installing from a git checkout without devDependencies, or a pruned tree.
  console.error(
    '@mohammedchaibi/windows-process-tree: node-gyp-build is not installed, cannot resolve a ' +
    'native binary. Run `npm install` first, or build manually with `npx node-gyp rebuild`.'
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [bin], { stdio: 'inherit' });

if (result.error) {
  console.error('@mohammedchaibi/windows-process-tree: failed to run node-gyp-build:', result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
