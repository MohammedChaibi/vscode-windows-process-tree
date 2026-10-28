/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Mohammed Chaibi. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_FOREGROUND_WINDOW_H_
#define SRC_FOREGROUND_WINDOW_H_

#include <napi.h>

// Windows keeps two notions apart. Every thread has its own active window and focus window,
// which a process may set for itself at any time (ShowWindow, SetActiveWindow, SetFocus). The
// system has one foreground window, and only the foreground thread's focus window receives
// keyboard input. A background process asking for the foreground is refused unless it owns the
// last input; Windows then activates the window locally and flashes its taskbar button. The
// window looks active (title bar, caret) while every keystroke still goes elsewhere. Electron's
// `isFocused()` and `focus` event report the local activation, so they cannot tell the two apart.

// Whether the window is the system foreground window, i.e. the one the keyboard goes to.
// JS signature: isForegroundWindow(handle: Buffer): boolean
// `handle` is the HWND as `BrowserWindow.getNativeWindowHandle()` returns it.
Napi::Value IsForegroundWindow(const Napi::CallbackInfo& info);

// The process id and title of the system foreground window, for a log line naming who has the
// keyboard. JS signature: getForegroundWindowInfo(): { pid: number; title: string } | null
// Returns null when there is no foreground window (the screen is locked, or a desktop switch).
Napi::Value GetForegroundWindowInfo(const Napi::CallbackInfo& info);

#endif  // SRC_FOREGROUND_WINDOW_H_
