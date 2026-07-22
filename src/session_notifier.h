/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_SESSION_NOTIFIER_H_
#define SRC_SESSION_NOTIFIER_H_

#include <napi.h>

// Starts listening for WM_WTSSESSION_CHANGE for the current session.
// JS signature: startSessionNotifications(callback: (evt: { event: number, sessionId: number }) => void): void
// The callback receives the raw WTS_* wParam code as `event` and the session id as `sessionId`.
Napi::Value StartSessionNotifications(const Napi::CallbackInfo& info);

// Stops listening and releases native resources.
// JS signature: stopSessionNotifications(): void
Napi::Value StopSessionNotifications(const Napi::CallbackInfo& info);

#endif  // SRC_SESSION_NOTIFIER_H_
