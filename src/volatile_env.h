/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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

#endif  // SRC_VOLATILE_ENV_H_
