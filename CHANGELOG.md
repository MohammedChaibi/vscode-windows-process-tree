# Changelog

## 0.7.2 — 2026-07-27

Install and build fixes for consumers on modern Node.js and stock Visual Studio installs.
**No API changes** — this is a drop-in patch upgrade.

### Fixed

- **Installs no longer fail on a stock MSVC toolchain.** The native build unconditionally
  requested `SpectreMitigation` (and `/ZH:SHA_256`), which needs the *optional* "MSVC — C++
  Spectre-mitigated libs" Visual Studio component. On a default "Desktop development with C++"
  install, MSBuild aborted with `MSB8040` before compiling anything. Both settings are now
  behind an opt-in `hardened_build` flag; published binaries are still built with them on.
- **The addon builds on MSVC v142 (VS2019) and v143 (VS2022)** with no configuration. node-gyp
  uses whichever Visual Studio it discovers, and nothing in `binding.gyp` pins a toolset. A new
  `msvs_toolset` knob can pin one explicitly, which CI uses to exercise both.

### Added

- **Prebuilt binaries ship inside the npm tarball.** Installing no longer runs node-gyp, MSVC, or
  Python, and no longer downloads Node headers. Because the addon targets Node-API (pinned to
  level 8), a single `prebuilds/win32-x64/node.napi.node` serves Node.js 20/22/24 *and* every
  Electron release from 22 onward — there is no per-ABI matrix and no rebuild when you switch
  runtimes. If no prebuild matches, the install still falls back to compiling from source.
- Windows CI matrix validating source builds across `windows-2022`/`windows-2025` ×
  `v142`/`v143` × Node 20/22/24, plus jobs that verify a clean tarball install performs no
  compilation and that Electron 22 and latest both load the prebuild.
- `engines.node` (`>=20.0.0`) and a support matrix in the README.
- Scripts: `npm run prebuild`, `npm run prebuild:arm64`, `npm run prebuild:check`,
  `npm run rebuild`.

### Changed

- New runtime dependency: `node-gyp-build` (no transitive dependencies) — it locates the native
  binary at require time.
- The published tarball is now an explicit allowlist (`files` in `package.json`). It gained
  `prebuilds/`, and no longer risks shipping a stale local `build/` directory.
- `prepublish` (deprecated by npm) replaced with `prepare`.

## Upgrade notes for downstream consumers

Upgrading from 0.7.1 is `npm install @mohammedchaibi/windows-process-tree@0.7.2` with no code
changes. Points worth checking:

1. **Node 18 now warns.** `engines.node` declares `>=20.0.0`, matching what CI validates. Node 18
   is EOL and untested; the addon will most likely still load, but it is no longer supported.
2. **Electron consumers can drop the rebuild step.** `electron-rebuild` /
   `@electron/rebuild` is no longer required for this package. If your pipeline force-rebuilds
   every native module, you may exclude this one.
3. **Bundlers and packagers must keep `prebuilds/`.** If you prune node_modules, use asar, or run
   a bundler that drops non-JS files, ensure `prebuilds/**` survives — e.g. electron-builder
   `files`/`asarUnpack`, or a webpack/esbuild `node-gyp-build` external. The old
   `build/Release/windows_process_tree.node` path does **not** exist in an installed package.
4. **Do not require the binary by path.** If you were loading
   `require('@mohammedchaibi/windows-process-tree/build/Release/windows_process_tree.node')`
   directly, switch to the package's public API. To locate the binary yourself, use
   `require('node-gyp-build')(packageRoot)`.
5. **If you need Spectre-mitigated binaries for compliance**, use the published prebuild (built
   with mitigation on) rather than a source build, or set `npm_config_hardened_build=1` when
   building — which requires the optional Spectre libs VS component to be installed.
6. **Air-gapped or proxied installs get simpler**, since no Node headers are fetched.
7. **If you compile from source, use a recent node-gyp.** npm 10 (Node.js 20 and 22) bundles
   node-gyp 10.1.0, which cannot detect Visual Studio 18 — it reports
   `unknown version "undefined"` and fails with `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`. The install
   hook now prefers a node-gyp resolvable from the package over npm's bundled copy, so adding
   `node-gyp` to your devDependencies is enough. Consumers on the prebuilt binary never compile
   and are unaffected.

## 0.7.1

- Added `findRegistryValue`, which locates a registry value by name across subkeys.

## 0.7.0

- Rebranded as the standalone `@mohammedchaibi/windows-process-tree`.
- Added Windows session-change notifications (`onSessionChange`,
  `stopSessionNotifications`) and registry reads (`readRegistryValue`).
- Added process `owner` data and `getSystemProcessList`.

Earlier history is that of
[microsoft/vscode-windows-process-tree](https://github.com/microsoft/vscode-windows-process-tree).
