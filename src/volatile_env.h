/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Mohammed Chaibi. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_VOLATILE_ENV_H_
#define SRC_VOLATILE_ENV_H_

#include <napi.h>

// Reads a REG_SZ value from the registry, mirroring `reg query "<keyPath>" /v <valueName>`.
// JS signature: readRegistryValue(keyPath: string, valueName: string, sessionId?: number): string
// keyPath includes the hive prefix (e.g. "HKCU\\Volatile Environment" or
// "HKEY_CURRENT_USER\\Volatile Environment"). When sessionId is provided the per-session
// subkey (keyPath\\<sessionId>) is tried first, falling back to keyPath. Returns "" if absent.
Napi::Value ReadRegistryValue(const Napi::CallbackInfo& info);

// Searches for a REG_SZ value BY NAME under a root key and its subkeys, returning the first
// non-empty match. Lets callers locate a value (e.g. CLIENTNAME) without knowing the exact,
// possibly session-dependent subkey (e.g. HKCU\\Volatile Environment\\<sessionId>).
// JS signature: findRegistryValue(valueName: string, rootKeyPath?: string, maxDepth?: number): string
// rootKeyPath defaults to "HKCU\\Volatile Environment"; maxDepth defaults to 1 (root + its
// immediate subkeys). Returns "" if not found or on non-Windows.
Napi::Value FindRegistryValue(const Napi::CallbackInfo& info);

#endif  // SRC_VOLATILE_ENV_H_
