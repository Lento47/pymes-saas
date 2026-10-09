# Launching the Android app on the emulator

One-liner:

```bash
.\scripts\run-android.ps1 --install-only
```

The script handles everything: stopping stale emulators, booting a fresh emulator with a **visible window**, installing the debug APK, and launching `MainActivity`.

## Usage

```bash
.\scripts\run-android.ps1 --help
```

| Flag | Effect |
|------|--------|
| `--build` | Full native build first (`expo run:android --variant debug`). Slow (~1–2 min on a warm cache). |
| `--install-only` | Skip the build; boot the emulator and install the existing APK + launch. Default. |
| `--kill` | Stop the emulator and ADB server, then exit. |
| `--help` | Show usage. |

## How it works

1. **Stop all emulator processes.** Killing only `emulator.exe` leaves `qemu-system-x86_64-headless` running in the background and holding the ADB port, so a fresh start looks like it failed.
2. **Start the emulator without `-no-window`.** A hidden window was the original reason we couldn't see the phone. The emulator should always launch with a visible window for local work.
3. **Wait for `adb get-state` → `device`.** Boot times vary; the script polls up to 60× 2 s.
4. **Install + launch.** `adb install -r` (force-reinstall over the existing app), then `am start app.pymeshub.lat/.MainActivity`.
5. **Verify.** The script confirms the process exists and that `MainActivity` is the focused activity.

### Metro port forwarding

After a `--build` or `expo start`, run `adb reverse tcp:8081 tcp:8081` so DevTools / reload / `chrome://inspect` work on-device. The script already does this.

## Known gotchas

### "I can't see the emulator"

The app built and ran fine, but no desktop window appeared. This happened because the emulator was started with `-no-window` (headless framebuffer only). The fix: start it without `-no-window` — `run-android.ps1` does this by default.

Also note: closing the emulator window does **not** kill the QEMU process; ADB keeps talking to it. Restarting the emulator through the script always kills `emulator.exe` *and* `qemu-system*` first.

### "Port already in use" / emulator won't start

A stale QEMU process holds the ADB socket. `run-android.ps1 --kill` stops everything; otherwise `adb kill-server` + restarting usually works. If port 5554 is truly occupied, change `$port` / `-port` in the script.

### The app shows on the wrong phone

There are two AVDs in this workspace:

| AVD | Device | Port |
|-----|--------|------|
| `pymeshub-api36` | **the target phone** (real-ish device image, 1080×2400) | 5554 |
| `pymeshub-map-verification` | secondary / legacy | 5556 |

The script defaults to `pymeshub-api36` — the phone you want. Change `$avd` and `$port` if you need the other one.

### Native build fails on a fresh clone

The debug build is usually incremental and fast. First-time or clean builds (`--clean` prebuild) can take a few minutes because of CMake / native library compilation. `expo run:android` outputs `BUILD SUCCESSFUL in <time>` — that's the green signal.

## Debugging

- **Is the app running?** `adb shell ps \| grep app.pymeshub`
- **What's on screen?** `adb shell screencap -p /sdcard/screenshot.png` then `adb pull /sdcard/screenshot.png`.
- **Logs?** `adb logcat` (filter with `adb logcat | grep app.pymeshub`).
- **Is Metro reachable on-device?** `adb reverse -l | grep 8081`.
- **Is the emulator actually visible?** Look for the window titled `Android Emulator - pymeshub-api36:5554` (check `Get-Process qemu-system* \| Select-Object MainWindowTitle`).

## Architecture note

`app.pymeshub.lat` is installed via the standard `expo run:android` debug pipeline (`android/app/build.gradle` → `assembleDebug` → `app-debug.apk`). The `with-android-release-signing` Expo plugin only touches the `release` build, so a local debug run needs no keystore. Production/EAS builds require `PYMESHUB_UPLOAD_STORE_FILE` / `*_PASSWORD` / `*_KEY_ALIAS` env vars (see `apps/mobile/plugins/with-android-release-signing.js`).
