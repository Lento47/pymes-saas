#!/usr/bin/env pwsh
#
# apps/mobile/scripts/run-android.ps1
#
# Launch the PymesHub Android app on the emulator with a visible window.
#
# Usage:
#     .\scripts\run-android.ps1 [--build] [--install-only] [--kill]
#
# Steps performed:
#   1. Stop any existing `emulator` / `qemu-system` processes (old headless
#      instances leave their QEMU process behind after `emulator.exe` exits).
#   2. Restart the emulator WITHOUT `-no-window` so the desktop window appears
#      (title: "Android Emulator - <avd>:<port>").
#   3. Wait for the device to come online (`adb get-state == device`).
#   4. Wait for the boot to **complete** (`sys.boot_completed == 1`) — installing
#      before this fails with "device is still booting".
#   5. Optionally rebuild with `expo run:android` (full native build).
#   6. Install the APK, forward Metro's port, and launch MainActivity.
#
# Notes:
#   - The app package is `app.pymeshub.lat` and its main activity is
#     `app.pymeshub.lat.MainActivity`.
#   - The emulator AVD is `pymeshub-api36` on port 5554.
#   - The previous problem: the emulator was started with `-no-window`, so no
#     desktop window appeared. Killing only `emulator.exe` left the
#     `qemu-system-x86_64-headless` process holding the port.
#   - Metro port forwarding (`adb reverse`) lets you open Chrome `chrome://inspect`
#     / React DevTools on the device after launching with `--inspect`.
#

param(
    [switch]$Build,
    [switch]$InstallOnly,
    [switch]$Kill,
    [switch]$Help
)

# Self-heal: set Bypass for THIS process only (never touches the machine-wide
# setting), so the script loads regardless of the user's execution policy.
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force 2>$null

$avd = "pymeshub-api36"
$port = 5554
$apkPath = "android/app/build/outputs/apk/debug/app-debug.apk"

function Write-Step($msg) {
    Write-Host "=== $msg" -ForegroundColor Cyan
}

function Write-Error($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
}

# Cleanup function: kill emulator + qemu, kill server, wait for port free.
function Stop-Emulator {
    Get-Process emulator, qemu-system* -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 3
    adb kill-server
    Start-Sleep -Seconds 3
    # Wait until ADB truly loses the device (proves the old instance is dead).
    $count = 0
    while ((adb get-state -s emulator-$port 2>$null) -ne "no-device" -and $count -lt 30) {
        Start-Sleep -Seconds 1
        $count++
    }
}

# Wait until the emulator has actually **finished booting**.
#
# `adb get-state` returning `device` and `getprop ro.product.model` answering both
# happen well before the package manager is up: an install at that moment fails with
# `Error: device is still booting`. `sys.boot_completed == 1` is the flag Android sets
# once the boot sequence completes, and it is the only one that means `adb install`
# will actually work.
function Wait-For-Adb-Ready {
    param([string]$Device = "emulator-$port")
    $count = 0
    while ($count -lt 120) {
        $booted = adb -s $Device shell getprop sys.boot_completed 2>$null
        if (($booted | Select-Object -First 1).Trim() -eq "1") { return $true }
        Start-Sleep -Seconds 2
        $count++
    }
    return $false
}

if ($Help) {
    Write-Host @"
Usage: .\scripts\run-android.ps1 [--build] [--install-only] [--kill]

  --build       Do a full native build (expo run:android) before launching.
                This is the slow step (~1-2 min on a warm cache).
  --install-only  Skip the build; just start the emulator and install the
                existing APK + launch MainActivity.
  --kill        Just stop the emulator and ADB server, then exit.
  --help        Show this help.

The emulator AVD is '$avd' on port $port. The app package is app.pymeshub.lat
(main activity: app.pymeshub.lat.MainActivity).
"@
    exit 0
}

if ($Kill) {
    Stop-Emulator
    exit 0
}

# Start the emulator with a VISIBLE window (never -no-window for local work).
Write-Step "Starting emulator '$avd' with visible window, port $port..."
Stop-Emulator

Start-Process "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
    -ArgumentList "-avd", $avd, "-port", $port -PassThru | Out-Null

# Wait for the device.
Write-Step "Waiting for emulator to boot..."
$count = 0
$ready = $false
while ($count -lt 60) {
    $state = adb get-state 2>$null
    if ($state -eq "device") {
        # Transport layer is up; now wait for the ADB daemon inside the emulator
        # to be fully responsive (it lags a few seconds behind "device" status).
        if (Wait-For-Adb-Ready) {
            $ready = $true
            break
        }
    }
    Start-Sleep -Seconds 1
    $count++
}
if (-not $ready) {
    Write-Error "Emulator did not come fully online after $count attempts"
    exit 1
}
Write-Output "Device ready."

if ($Build) {
    Write-Step "Building native app (this may take a while)..."
    Push-Location (Split-Path $PSScriptRoot -Parent)
    npx expo run:android --variant debug
    Pop-Location
}

# Install with retry (ADB can be briefly unavailable right after boot).
function Install-Apk {
    param($Apk)
    $count = 0
    while ($count -lt 6) {
        $out = adb install -r "$Apk" 2>&1
        if ($out -match "Success") {
            Write-Output "APK installed."
            return
        }
        $count++
        Start-Sleep -Seconds 2
    }
    Write-Error "APK install failed after 6 attempts: $out"
    exit 1
}

# Install + launch.
Write-Step "Installing app-debug.apk and launching MainActivity..."
Install-Apk "$apkPath"

# Forward Metro's bundler port so DevTools / reload work on-device. Verify it
# actually landed rather than trusting the exit code — `adb reverse` prints the
# port either way, so the check is the `--list` output.
adb reverse tcp:8081 tcp:8081 | Out-Null
if (adb reverse --list | Select-String -Pattern "tcp:8081") {
    Write-Output "Metro forwarded: adb reverse tcp:8081 tcp:8081"
} else {
    Write-Output "NOTE: adb reverse did not take. Start Metro with: npx expo start"
}

Start-Sleep -Seconds 3
adb shell am start -n app.pymeshub.lat/.MainActivity `
    -a android.intent.action.MAIN `
    -c android.intent.category.LAUNCHER
Start-Sleep -Seconds 3

# Verify the app is running and focused.
$proc = adb shell ps | Select-String "app.pymeshub" | Select-Object -First 1
Start-Sleep -Seconds 1
$focused = adb shell dumpsys window | Select-String -Pattern "mFocusedApp" | Select-Object -First 1

Write-Output "=== status ==="
Write-Output "process: $proc"
Write-Output "focused: $focused"

if ($proc -like "*app.pymeshub*" -and $focused -like "*app.pymeshub*") {
    Write-Output "App is running and in focus. Emulator window title: 'Android Emulator - ${avd}:${port}'"
    exit 0
} else {
    Write-Error "App did not start as expected."
    exit 1
}
