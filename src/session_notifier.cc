/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Mohammed Chaibi. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "session_notifier.h"

#include <windows.h>
#include <wtsapi32.h>

#include <atomic>
#include <thread>

// Receives WM_WTSSESSION_CHANGE (console/remote connect & disconnect, lock/unlock, logon/logoff)
// for THIS session and marshals each event to the JS callback via a ThreadSafeFunction.
//
// The window messages are thread-affine, so a dedicated worker thread owns an invisible
// message-only window (HWND_MESSAGE) and runs its own message loop. No visible window is
// created. Only one notifier can be active at a time (guarded by g_running).

namespace {

constexpr wchar_t kWindowClassName[] = L"WptSessionNotifierWindow";

Napi::ThreadSafeFunction g_tsfn;
std::thread g_thread;
std::atomic<HWND> g_hwnd{nullptr};
std::atomic<bool> g_running{false};

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_WTSSESSION_CHANGE) {
    const uint32_t event = static_cast<uint32_t>(wParam);
    const uint32_t sessionId = static_cast<uint32_t>(lParam);
    // NonBlockingCall is safe from this worker thread; it queues the invocation
    // onto the Node.js event loop thread.
    g_tsfn.NonBlockingCall([event, sessionId](Napi::Env env, Napi::Function cb) {
      Napi::Object evt = Napi::Object::New(env);
      evt.Set("event", Napi::Number::New(env, event));
      evt.Set("sessionId", Napi::Number::New(env, sessionId));
      cb.Call({evt});
    });
    return 0;
  }
  if (msg == WM_DESTROY) {
    PostQuitMessage(0);
    return 0;
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

void RunMessageLoop() {
  HINSTANCE hInstance = GetModuleHandleW(nullptr);

  WNDCLASSEXW wc = {};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInstance;
  wc.lpszClassName = kWindowClassName;
  RegisterClassExW(&wc);  // ERROR_CLASS_ALREADY_EXISTS is fine (re-start)

  HWND hwnd = CreateWindowExW(0, kWindowClassName, L"WptSessionNotifier", 0,
                              0, 0, 0, 0, HWND_MESSAGE, nullptr, hInstance, nullptr);
  if (!hwnd) {
    return;
  }
  g_hwnd.store(hwnd);

  WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION);

  MSG msg;
  BOOL ret;
  while ((ret = GetMessageW(&msg, nullptr, 0, 0)) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }

  WTSUnRegisterSessionNotification(hwnd);
  DestroyWindow(hwnd);
  UnregisterClassW(kWindowClassName, hInstance);
  g_hwnd.store(nullptr);
}

}  // namespace

Napi::Value StartSessionNotifications(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsFunction()) {
    throw Napi::TypeError::New(
        env, "startSessionNotifications expects a callback function.");
  }

  if (g_running.exchange(true)) {
    // Already listening; ignore duplicate start.
    return env.Undefined();
  }

  g_tsfn = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(),
                                         "SessionNotifier", 0, 1);
  g_thread = std::thread(RunMessageLoop);

  return env.Undefined();
}

Napi::Value StopSessionNotifications(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!g_running.exchange(false)) {
    return env.Undefined();
  }

  HWND hwnd = g_hwnd.load();
  if (hwnd) {
    // WM_CLOSE -> DefWindowProc destroys the window -> WM_DESTROY -> PostQuitMessage,
    // which ends the message loop cleanly.
    PostMessageW(hwnd, WM_CLOSE, 0, 0);
  }

  if (g_thread.joinable()) {
    g_thread.join();
  }

  // The worker thread has stopped, so no more NonBlockingCall can occur.
  g_tsfn.Release();

  return env.Undefined();
}
