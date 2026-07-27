# @mohammedchaibi/windows-process-tree

A Node.js / Electron native (N-API) library for Windows that quickly fetches process‑tree
information and, in addition, exposes Windows **session‑change notifications**
(`WM_WTSSESSION_CHANGE`) and direct **registry value reads**.

> This is a standalone project derived from
> [microsoft/vscode-windows-process-tree](https://github.com/microsoft/vscode-windows-process-tree)
> (MIT). It extends the original process‑tree functionality with additional process information
> (process **owner**, and a flat system‑wide process list), and adds Windows session‑change and
> registry APIs used for VDI session‑roaming detection. See
> [Attribution & license](#attribution--license).

## Install

```sh
npm install @mohammedchaibi/windows-process-tree
```

**No compiler required.** The published package ships a prebuilt Windows binary, so installing
does not invoke node‑gyp, MSVC, or Python. Because the addon is built against Node‑API, that one
binary is loaded by every supported Node.js *and* Electron version — there is nothing to rebuild
when you change runtimes.

The full source (`binding.gyp` + `src/`) ships too, so if no prebuilt binary matches your
platform the install falls back to compiling locally, and `electron-rebuild` still works if you
prefer to build it yourself.

Windows‑only functionality: the package installs cleanly on macOS and Linux (where the native
build is skipped entirely), but all functions are no‑ops or throw there — noted per API below.

## Support matrix

| | Supported |
| --- | --- |
| Platform | Windows 10, Windows 11, Windows Server 2016+ |
| Prebuilt architectures | `win32-x64` (plus `win32-arm64` when the release build produces it) |
| Node.js | **20.x, 22.x, 24.x** — validated in CI on every push |
| Electron | **22 and newer** — any release providing Node‑API 8+ |
| Node‑API level | 8 (pinned via `NAPI_VERSION`, so prebuilds stay forward‑compatible) |
| Toolchain for source builds | MSVC **v142** (VS2019) or **v143** (VS2022) — both validated in CI |
| Other platforms | Install succeeds; every API is a no‑op or throws |

A source build needs nothing beyond a stock **"Desktop development with C++"** Visual Studio
workload. No ClangCL toolset, and no optional Spectre‑mitigated libraries — see
[Building](#building) if you want the hardened configuration used for published binaries.

## Process tree API

```ts
import * as child_process from 'child_process';
import { getProcessTree } from '@mohammedchaibi/windows-process-tree';

if (process.platform === 'win32') {
  child_process.spawn('cmd.exe');
  getProcessTree(process.pid, (tree) => {
    console.log(tree);
  });
  // { pid: 11168, name: 'node.exe', children: [ { pid: 1472, name: 'cmd.exe', children: [] } ] }
}
```

Also available: `getProcessList`, `getProcessCpuUsage`, `getSystemProcessList`,
`buildProcessTree`, `filterProcessList`, and `ProcessDataFlag`. Each callback‑based function has a
`util.promisify`‑compatible form. For the full API see the
[typings file](./typings/windows-process-tree.d.ts).

Beyond the upstream project, this fork adds to the process‑info side: the process **owner**
(request it with `ProcessDataFlag.Owner`; returned in the `owner` field) and
`getSystemProcessList` — a flat, system‑wide listing of all processes rather than a single tree.

## Session‑change notifications

Subscribe to Windows Terminal Services session events for the current session (console/remote
connect & disconnect, lock/unlock, logon/logoff). Backed by an invisible message‑only window on a
dedicated native thread — no visible window is created. Only one subscription is active at a time.

```ts
import { onSessionChange, stopSessionNotifications, SessionEvent } from '@mohammedchaibi/windows-process-tree';

onSessionChange(({ event, sessionId }) => {
  if (event === SessionEvent.RemoteDisconnect || event === SessionEvent.ConsoleDisconnect) {
    console.log('session detached', sessionId);
  } else if (event === SessionEvent.RemoteConnect || event === SessionEvent.ConsoleConnect) {
    console.log('session attached', sessionId);
  }
});

// later, on shutdown:
stopSessionNotifications();
```

`event` is the raw `WM_WTSSESSION_CHANGE` `wParam` code, exposed as the `SessionEvent` enum:

| Value | `SessionEvent`      |
| ----- | ------------------- |
| 1     | `ConsoleConnect`    |
| 2     | `ConsoleDisconnect` |
| 3     | `RemoteConnect`     |
| 4     | `RemoteDisconnect`  |
| 5     | `SessionLogon`      |
| 6     | `SessionLogoff`     |
| 7     | `SessionLock`       |
| 8     | `SessionUnlock`     |

On non‑Windows platforms `onSessionChange` / `stopSessionNotifications` are no‑ops.

## Registry value reads

Read a `REG_SZ` value, mirroring `reg query "<keyPath>" /v <valueName>`. `keyPath` includes the
hive prefix (e.g. `HKCU\Volatile Environment`, `HKLM\SOFTWARE\...`). When `sessionId` is provided,
the per‑session subkey (`<keyPath>\<sessionId>`) is tried first, falling back to `keyPath`. Returns
`''` when the value is absent or on non‑Windows platforms.

```ts
import { readRegistryValue } from '@mohammedchaibi/windows-process-tree';

// e.g. the VDI client machine name published into HKCU\Volatile Environment
const clientName = readRegistryValue('HKCU\\Volatile Environment', 'CLIENTNAME');
```

When the exact subkey is **dynamic or unknown** — e.g. multi-session hosts publish the client name
at `HKCU\Volatile Environment\<sessionId>\CLIENTNAME` where `<sessionId>` changes — search by name
instead. `findRegistryValue` walks a root key and its subkeys and returns the first non-empty match
(`rootKeyPath` defaults to `HKCU\Volatile Environment`, `maxDepth` defaults to 1):

```ts
import { findRegistryValue } from '@mohammedchaibi/windows-process-tree';

// Finds CLIENTNAME whether it's directly under Volatile Environment or in a per-session subkey,
// without configuring the exact path:
const clientName = findRegistryValue('CLIENTNAME');
```

## Why a native module?

Shelling out to `wmic.exe`/`reg.exe` is slow (a process spawn per call, ~100ms+) and, for the
process tree, only goes one level deep. This module uses Windows APIs directly and returns the whole
tree in well under 20ms, while the registry/session APIs avoid spawning `reg query` entirely.

## Building

```sh
npm install            # also compiles the addon into build/Release/
npm run compile        # compile the TypeScript wrapper (lib/*.js)
npm test
npm run rebuild        # recompile the addon after changing src/*.cc
```

Requires a stock Visual Studio **"Desktop development with C++"** workload (VS2019 or VS2022) plus
Python, which node-gyp needs. node-gyp picks whichever Visual Studio it discovers and uses that
install's default toolset, so no configuration is needed for either version.

> **Building from source needs a recent node-gyp.** npm 10 — what Node.js 20 and 22 ship — bundles
> node-gyp 10.1.0, which cannot detect **Visual Studio 18**: it reports
> `unknown version "undefined"` and fails with `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`. This repo pins
> a current node-gyp as a devDependency and the install hook prefers it over npm's bundled copy.
> If you are compiling this package from source in your own project on Node 20/22 with VS18
> installed, add `node-gyp` to your devDependencies or install it globally. Consumers using the
> published prebuilt binary are unaffected, since nothing is compiled.

### Build knobs

Both are read as `npm_config_*` environment variables and forwarded to gyp (see `binding.gyp`):

| Variable | Default | Effect |
| --- | --- | --- |
| `npm_config_hardened_build` | `0` | `1` enables Spectre mitigation and `/ZH:SHA_256`. **Requires the optional "MSVC — C++ Spectre‑mitigated libs" VS component**; without it MSBuild fails with `MSB8040`. Off by default so stock installs build; published prebuilds are built with it on. |
| `npm_config_msvs_toolset` | *(auto)* | Pins `PlatformToolset`, e.g. `v142` or `v143`. Used by CI to validate both toolchains; normally leave unset. |

```sh
# reproduce a published binary locally
npm_config_hardened_build=1 npx node-gyp rebuild

# build the way CI validates the VS2019 toolchain
npm_config_msvs_toolset=v142 npx node-gyp rebuild
```

### Producing prebuilt binaries

```sh
npm run prebuild         # -> prebuilds/win32-x64/node.napi.node (hardened)
npm run prebuild:arm64   # -> prebuilds/win32-arm64/node.napi.node
npm run prebuild:check   # assert the prebuilds exist, resolve, and expose the full API
```

Prebuilds are **not** committed; the `Release` workflow builds, verifies, and ships them inside
the npm tarball. Note that `npm run prebuild` *moves* the binary out of `build/Release`, so run
`npm run rebuild` afterwards to get a local development build back.

At runtime the binary is located by [`node-gyp-build`](https://github.com/prebuild/node-gyp-build),
which prefers `build/Release` (your local build) and falls back to `prebuilds/`. Set
`PREBUILDS_ONLY=1` to force the packaged prebuild.

## Attribution & license

MIT. Originally created by Microsoft Corporation as
[microsoft/vscode-windows-process-tree](https://github.com/microsoft/vscode-windows-process-tree);
this fork extends the process‑info APIs (process owner, system‑wide process list), adds
session‑change and registry APIs, and is maintained separately. The original copyright notice is
retained in [LICENSE](./LICENSE) as required. This project is not affiliated with or endorsed by
Microsoft.
