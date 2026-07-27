/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * npm `install` hook.
 *
 * 1. Off Windows there is nothing to do -- the package stays installable everywhere because all
 *    of its native APIs are documented as no-ops there.
 * 2. On Windows, if a bundled prebuild (or an earlier local build) loads, we are done. This is
 *    the path every consumer of the published package takes: no compiler, no Python, no
 *    downloaded headers.
 * 3. Otherwise compile with node-gyp.
 *
 * Step 3 deliberately does not delegate to node-gyp-build's own bin. That resolves node-gyp by
 * spawning `node-gyp.cmd` through a shell and relying on PATH, which fails wherever npm does not
 * put a node-gyp shim on PATH -- npm 10 on GitHub's Windows runners, for instance, while npm 11
 * works. Resolving node-gyp explicitly (npm publishes its bundled copy via `npm_config_node_gyp`)
 * makes the source-build fallback behave the same across npm versions.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '@mohammedchaibi/windows-process-tree:';
const ROOT = path.join(__dirname, '..');

if (process.platform !== 'win32') {
  console.log(LOG_PREFIX + ' skipping native build on ' + process.platform +
    ' (Windows-only addon; all APIs are no-ops here).');
  process.exit(0);
}

// --- 2. Is there already a usable binary? ---------------------------------------------------

try {
  const resolved = require('node-gyp-build').path(ROOT);
  // Actually load it, so a prebuild for the wrong architecture falls through to a source build
  // instead of being accepted on the strength of its filename.
  require(resolved);
  console.log(LOG_PREFIX + ' using ' + path.relative(ROOT, resolved) + ' (no compilation needed)');
  process.exit(0);
} catch (err) {
  console.log(LOG_PREFIX + ' no usable prebuilt binary for ' + process.platform + '-' +
    process.arch + ', compiling from source');
}

// --- 3. Compile ------------------------------------------------------------------------------

function runNodeGypScript(script) {
  if (!script || !fs.existsSync(script)) {
    return null;
  }
  console.log(LOG_PREFIX + ' building with ' + script);
  const result = spawnSync(process.execPath, [script, 'rebuild'], { cwd: ROOT, stdio: 'inherit' });
  // A spawn failure means "try the next candidate"; a non-zero exit means node-gyp ran and the
  // build genuinely failed, which must not be masked by trying another copy of node-gyp.
  return result.error ? null : (result.status === null ? 1 : result.status);
}

const candidates = [];

// A node-gyp resolvable from this package is preferred over the one npm bundles, because the
// bundled copy can be years old: npm 10 (Node.js 20 and 22) ships node-gyp 10.1.0, which cannot
// detect Visual Studio 18 at all -- it reports `unknown version "undefined"` and fails with
// ERR_CHILD_PROCESS_STDIO_MAXBUFFER. Newer node-gyp handles it.
try {
  candidates.push(require.resolve('node-gyp/bin/node-gyp.js'));
} catch (err) {
  // not installed here; the package does not depend on it at runtime
}

// npm sets this for lifecycle scripts, pointing at the node-gyp it bundles.
if (process.env.npm_config_node_gyp) {
  candidates.push(process.env.npm_config_node_gyp);
}

for (const candidate of candidates) {
  const status = runNodeGypScript(candidate);
  if (status !== null) {
    process.exit(status);
  }
}

// Last resort: whatever `node-gyp` PATH offers.
console.log(LOG_PREFIX + ' falling back to node-gyp on PATH');
const viaPath = spawnSync('node-gyp.cmd', ['rebuild'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  windowsHide: true
});

if (viaPath.error || viaPath.status === null) {
  console.error(LOG_PREFIX + ' could not locate node-gyp to build the native addon.');
  console.error(LOG_PREFIX + ' install node-gyp (npm i -g node-gyp) or report this at');
  console.error(LOG_PREFIX + ' https://github.com/MohammedChaibi/vscode-windows-process-tree/issues');
  process.exit(1);
}

process.exit(viaPath.status);
