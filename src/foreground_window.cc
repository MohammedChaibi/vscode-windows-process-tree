/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Mohammed Chaibi. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "foreground_window.h"

#include <windows.h>

#include <cstring>

namespace {

// The HWND Electron hands out: a Buffer holding the pointer in native byte order.
HWND HandleFromBuffer(const Napi::CallbackInfo& info, const char* fn) {
  Napi::Env env(info.Env());

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    throw Napi::TypeError::New(env, std::string(fn) +
        " expects a window handle Buffer (BrowserWindow.getNativeWindowHandle()).");
  }

  Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
  if (buffer.Length() < sizeof(HWND)) {
    throw Napi::TypeError::New(env, std::string(fn) +
        " got a handle Buffer shorter than a native window handle.");
  }

  HWND hwnd = nullptr;
  std::memcpy(&hwnd, buffer.Data(), sizeof(HWND));
  return hwnd;
}

}  // namespace

Napi::Value IsForegroundWindow(const Napi::CallbackInfo& info) {
  Napi::Env env(info.Env());
  const HWND hwnd = HandleFromBuffer(info, "isForegroundWindow");
  const HWND foreground = ::GetForegroundWindow();
  return Napi::Boolean::New(env, foreground != nullptr && foreground == hwnd);
}

Napi::Value GetForegroundWindowInfo(const Napi::CallbackInfo& info) {
  Napi::Env env(info.Env());
  const HWND foreground = ::GetForegroundWindow();
  if (foreground == nullptr) {
    return env.Null();
  }

  DWORD pid = 0;
  ::GetWindowThreadProcessId(foreground, &pid);

  // A title is for the log only: 256 characters is plenty, and a window without one gives "".
  wchar_t title[256];
  const int length = ::GetWindowTextW(foreground, title, 256);

  Napi::Object result = Napi::Object::New(env);
  result.Set("pid", Napi::Number::New(env, static_cast<double>(pid)));
  result.Set("title", Napi::String::New(env, reinterpret_cast<const char16_t*>(title),
                                        length > 0 ? static_cast<size_t>(length) : 0));
  return result;
}
