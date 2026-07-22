/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "volatile_env.h"

#include <windows.h>

#include <string>

namespace {

// Splits the leading hive token off a `reg query`-style path (e.g. "HKCU\\Volatile Environment").
// Returns the HKEY and sets `subkey` to the remainder. Returns nullptr for an unknown hive.
HKEY ParseHive(const std::wstring& keyPath, std::wstring& subkey) {
  const size_t sep = keyPath.find(L'\\');
  std::wstring hive = (sep == std::wstring::npos) ? keyPath : keyPath.substr(0, sep);
  subkey = (sep == std::wstring::npos) ? L"" : keyPath.substr(sep + 1);

  for (wchar_t& c : hive) {
    c = static_cast<wchar_t>(::towupper(c));
  }

  if (hive == L"HKCU" || hive == L"HKEY_CURRENT_USER") return HKEY_CURRENT_USER;
  if (hive == L"HKLM" || hive == L"HKEY_LOCAL_MACHINE") return HKEY_LOCAL_MACHINE;
  if (hive == L"HKU" || hive == L"HKEY_USERS") return HKEY_USERS;
  if (hive == L"HKCR" || hive == L"HKEY_CLASSES_ROOT") return HKEY_CLASSES_ROOT;
  if (hive == L"HKCC" || hive == L"HKEY_CURRENT_CONFIG") return HKEY_CURRENT_CONFIG;
  return nullptr;
}

// Reads a REG_SZ value under hive\subkey. Returns "" when missing.
std::wstring ReadRegSz(HKEY hive, const std::wstring& subkey, const std::wstring& valueName) {
  DWORD cb = 0;
  LONG rc = ::RegGetValueW(hive, subkey.c_str(), valueName.c_str(),
                           RRF_RT_REG_SZ, nullptr, nullptr, &cb);
  if (rc != ERROR_SUCCESS || cb == 0) {
    return L"";
  }

  std::wstring buf(cb / sizeof(wchar_t), L'\0');
  rc = ::RegGetValueW(hive, subkey.c_str(), valueName.c_str(),
                      RRF_RT_REG_SZ, nullptr, buf.data(), &cb);
  if (rc != ERROR_SUCCESS) {
    return L"";
  }

  // RegGetValueW null-terminates and reports the size including it; trim to actual length.
  buf.resize(::wcslen(buf.c_str()));
  return buf;
}

}  // namespace

Napi::Value ReadRegistryValue(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    throw Napi::TypeError::New(
        env, "readRegistryValue expects (keyPath: string, valueName: string, sessionId?: number).");
  }

  const std::u16string keyPathU16 = info[0].As<Napi::String>().Utf16Value();
  const std::u16string valueNameU16 = info[1].As<Napi::String>().Utf16Value();
  const std::wstring keyPath(keyPathU16.begin(), keyPathU16.end());
  const std::wstring valueName(valueNameU16.begin(), valueNameU16.end());

  std::wstring baseSubkey;
  const HKEY hive = ParseHive(keyPath, baseSubkey);
  if (!hive) {
    return Napi::String::New(env, "");
  }

  std::wstring result;
  if (info.Length() >= 3 && info[2].IsNumber()) {
    const DWORD sessionId =
        static_cast<DWORD>(info[2].As<Napi::Number>().Uint32Value());
    const std::wstring sessionSubkey = baseSubkey + L"\\" + std::to_wstring(sessionId);
    result = ReadRegSz(hive, sessionSubkey, valueName);
  }

  if (result.empty()) {
    result = ReadRegSz(hive, baseSubkey, valueName);
  }

  // wchar_t is UTF-16 on Windows, so this is a direct reinterpretation.
  const std::u16string out(result.begin(), result.end());
  return Napi::String::New(env, out);
}
