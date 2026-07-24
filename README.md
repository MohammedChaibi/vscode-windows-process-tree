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

Windows‑only. All functions are no‑ops or throw on non‑Windows platforms (noted per API below).
The package ships a prebuilt binary and its source (`binding.gyp` + `src/`) so it can also be
rebuilt against Electron via `electron-rebuild`.

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
npm install
npx node-gyp rebuild   # build the native addon (build/Release/windows_process_tree.node)
npm run compile        # compile the TypeScript wrapper (lib/*.js)
npm test
```

Requires the Windows build toolchain (Visual Studio C++ + node-gyp).

## Attribution & license

MIT. Originally created by Microsoft Corporation as
[microsoft/vscode-windows-process-tree](https://github.com/microsoft/vscode-windows-process-tree);
this fork extends the process‑info APIs (process owner, system‑wide process list), adds
session‑change and registry APIs, and is maintained separately. The original copyright notice is
retained in [LICENSE](./LICENSE) as required. This project is not affiliated with or endorsed by
Microsoft.
