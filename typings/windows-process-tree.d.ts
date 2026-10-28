/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module '@mohammedchaibi/windows-process-tree' {
  export enum ProcessDataFlag {
    None = 0,
    Memory = 1,
    CommandLine = 2,
    Owner = 4
  }

  export interface IProcessInfo {
    pid: number;
    ppid: number;
    name: string;

    /**
     * The working set size of the process, in bytes.
     */
    memory?: number;

    /**
     * The string returned is at most 512 chars, strings exceeding this length are truncated.
     */
    commandLine?: string;

    owner?: string;
  }

  export interface IProcessCpuInfo extends IProcessInfo {
    cpu?: number;
  }

  export interface IProcessTreeNode {
    pid: number;
    name: string;
    memory?: number;
    commandLine?: string;
    owner?: string;
    children: IProcessTreeNode[];
  }

  /**
   * Returns a tree of processes with the rootPid process as the root.
   * @param rootPid - The pid of the process that will be the root of the tree.
   * @param callback - The callback to use with the returned list of processes.
   * @param flags - The flags for what process data should be included.
   */
  export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode | undefined) => void, flags?: ProcessDataFlag): void;

  namespace getProcessTree {
    function __promisify__(rootPid: number, flags?: ProcessDataFlag): Promise<IProcessTreeNode>;
  }

  /**
   * Returns a list of processes containing the rootPid process and all of its descendants.
   * @param rootPid - The pid of the process of interest.
   * @param callback - The callback to use with the returned set of processes.
   * @param flags - The flags for what process data should be included.
   */
  export function getProcessList(rootPid: number, callback: (processList: IProcessInfo[] | undefined) => void, flags?: ProcessDataFlag): void;

  namespace getProcessList {
    function __promisify__(rootPid: number, flags?: ProcessDataFlag): Promise<IProcessInfo[]>;
  }

  /**
   * Returns the list of processes annotated with cpu usage information.
   * @param processList - The list of processes.
   * @param callback - The callback to use with the returned list of processes.
   */
  export function getProcessCpuUsage(processList: IProcessInfo[], callback: (processListWithCpu: IProcessCpuInfo[]) => void): void;

  namespace getProcessCpuUsage {
    function __promisify__(processList: IProcessInfo[]): Promise<IProcessCpuInfo[]>;
  }

  /**
 * Returns a flat, system-wide list of processes.
 * @param callback - The callback to use with the returned list of processes.
 * @param flags - The flags for what process data should be included.
 */
  export function getSystemProcessList(
    callback: (processList: IProcessInfo[]) => void,
    flags?: ProcessDataFlag
  ): void;

  namespace getSystemProcessList {
    function __promisify__(flags?: ProcessDataFlag): Promise<IProcessInfo[]>;
  }

  /**
   * Raw WTS session-change codes delivered by WM_WTSSESSION_CHANGE (wParam).
   */
  export enum SessionEvent {
    ConsoleConnect = 1,
    ConsoleDisconnect = 2,
    RemoteConnect = 3,
    RemoteDisconnect = 4,
    SessionLogon = 5,
    SessionLogoff = 6,
    SessionLock = 7,
    SessionUnlock = 8
  }

  export interface ISessionChange {
    /** The raw WTS_* event code (see SessionEvent). */
    event: number;
    /** The Windows session id the change applies to. */
    sessionId: number;
  }

  /**
   * Subscribes to WTS session-change notifications for the current session. Only one
   * subscription is active at a time; call stopSessionNotifications to release it.
   * No-op on non-Windows platforms.
   */
  export function onSessionChange(callback: (evt: ISessionChange) => void): void;

  /** Stops session-change notifications started by onSessionChange. */
  export function stopSessionNotifications(): void;

  /**
   * Reads a REG_SZ value, mirroring `reg query "<keyPath>" /v <valueName>`. keyPath includes the
   * hive prefix (e.g. HKCU\Volatile Environment). When sessionId is provided the per-session
   * subkey is tried first, falling back to keyPath. Returns '' when absent or on non-Windows.
   */
  export function readRegistryValue(keyPath: string, valueName: string, sessionId?: number): string;

  /**
   * Searches for a REG_SZ value by name under a root key and its subkeys, returning the first
   * non-empty match. Use when the exact subkey is dynamic/unknown (e.g. a session-dependent
   * HKCU\Volatile Environment\<sessionId>). rootKeyPath defaults to HKCU\Volatile Environment;
   * maxDepth defaults to 1. Returns '' when absent or on non-Windows.
   */
  export function findRegistryValue(valueName: string, rootKeyPath?: string, maxDepth?: number): string;

  /** Who holds the system foreground window, i.e. the keyboard. See getForegroundWindowInfo. */
  export interface IForegroundWindowInfo {
    /** The process id owning the foreground window. */
    pid: number;
    /** The foreground window's title; '' when it has none. */
    title: string;
  }

  /**
   * Whether the window is the system foreground window - the one the keyboard goes to. handle is
   * the HWND as BrowserWindow.getNativeWindowHandle() returns it. Electron's isFocused() and
   * focus event report a thread-local activation that Windows grants a background process while
   * keeping the keyboard elsewhere; this tells the two apart. Returns false on non-Windows.
   */
  export function isForegroundWindow(handle: Buffer): boolean;

  /**
   * The process id and title of the system foreground window, for a log line naming who has the
   * keyboard. Returns null when there is no foreground window or on non-Windows platforms.
   */
  export function getForegroundWindowInfo(): IForegroundWindowInfo | null;
}
