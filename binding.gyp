{
  "variables": {
    # Extra hardening that depends on *optional* Visual Studio components, so it is
    # off by default: a stock "Desktop development with C++" install cannot build it.
    #   - SpectreMitigation requires the "MSVC vNNN - C++ x64/x86 Spectre-mitigated
    #     libs" component; without it MSBuild fails with MSB8040.
    #   - /ZH:SHA_256 requires VS2019 16.4+.
    # The prebuilt binaries we publish are built with hardened_build=1; consumers who
    # compile from source get a build that works on any MSVC v142/v143 toolchain.
    # Enable with: npm_config_hardened_build=1 npx node-gyp rebuild
    "hardened_build%": 0,

    # Optional PlatformToolset pin (e.g. "v142" or "v143"). Empty means "use the
    # default toolset of whichever Visual Studio node-gyp discovers", which is how
    # both VS2019 (v142) and VS2022 (v143) are supported without configuration.
    # Enable with: npm_config_msvs_toolset=v142 npx node-gyp rebuild
    "msvs_toolset%": ""
  },
  "targets": [
    {
      "target_name": "windows_process_tree",
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except",
      ],
      "conditions": [
        ['OS=="win"', {
          "sources": [
            "src/addon.cc",
            "src/cpu_worker.cc",
            "src/foreground_window.cc",
            "src/process.cc",
            "src/process_worker.cc",
            "src/process_commandline.cc",
            "src/process_owner.cc",
            "src/session_notifier.cc",
            "src/volatile_env.cc"
          ],
          "include_dirs": [],
          # Pin the Node-API level so one binary is loadable by every runtime in the
          # support matrix: Node.js 20/22/24 and Electron 22+ all provide Node-API 8+.
          "defines": [ "NAPI_VERSION=8" ],
          "libraries": [ 'psapi.lib', 'advapi32.lib', 'wtsapi32.lib', 'user32.lib' ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": [
                "/guard:cf",
                "/w34244",
                "/we4267"
              ]
            },
            "VCLinkerTool": {
              "AdditionalOptions": [
                "/guard:cf"
              ]
            }
          },
          "conditions": [
            ['hardened_build==1', {
              "msvs_configuration_attributes": {
                "SpectreMitigation": "Spectre"
              },
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "AdditionalOptions": [
                    "/ZH:SHA_256"
                  ]
                }
              }
            }],
            ['msvs_toolset!=""', {
              "msbuild_toolset": "<(msvs_toolset)"
            }]
          ]
        }]
      ]
    }
  ]
}
