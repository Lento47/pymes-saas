#!/usr/bin/env bash
#
# apps/mobile/scripts/load-android.sh
#
# One command to get the dev build running: emulator -> boot -> Metro ->
# `adb reverse tcp:8081` -> launch the app.
#
# Usage:
#     ./scripts/load-android.sh            # start whatever is missing, then launch
#     ./scripts/load-android.sh --reload   # force-stop the app first, for a cold load
#     ./scripts/load-android.sh --no-metro # emulator + reverse + launch only
#
# Every step is idempotent: an emulator that is already booted, a Metro that is
# already serving this app's port, and an `adb reverse` that is already listed
# are all reused rather than restarted. That is deliberate — restarting Metro
# costs a full bundle, and re-running `adb reverse` on a working one is the
# thing that silently drops the entry it just registered.
#
# `run-android.ps1` next to this file is the *other* half: it does the native
# build (`expo run:android`) and the install. This script assumes the APK is
# already on the device and only does the day-to-day loop.
#
# Notes:
#   - AVD `pymeshub-api36` on `emulator-5554`; app package `app.pymeshub.lat`,
#     main activity `app.pymeshub.lat/.MainActivity` (see run-android.ps1).
#   - `adb reverse`, not `adb forward`: it is the *device* reaching the host's
#     8081, which is what the dev build does to fetch its JS bundle.
#   - Git Bash rewrites `/`-leading arguments into Windows paths before any
#     `adb shell` sees them (`am start -n app.pymeshub.lat/.MainActivity`
#     arrives as `app.pymeshub.lat/ACTIVITY`-style nonsense). MSYS_NO_PATHCONV
#     is set below, for this process only.

set -uo pipefail

AVD="${PYMESHUB_AVD:-pymeshub-api36}"
DEVICE="${PYMESHUB_DEVICE:-emulator-5554}"
METRO_PORT="${PYMESHUB_METRO_PORT:-8081}"
PKG="app.pymeshub.lat"
ACTIVITY="$PKG/.MainActivity"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$LOCALAPPDATA/Android/Sdk}}"
EMULATOR="$SDK/emulator/emulator.exe"
[ -x "$EMULATOR" ] || EMULATOR="$SDK/emulator/emulator"

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${TMPDIR:-/tmp}"
EMULATOR_LOG="$LOG_DIR/pymeshub-emulator.log"
METRO_LOG="$LOG_DIR/pymeshub-metro.log"

export MSYS_NO_PATHCONV=1

RELOAD=0
START_METRO=1
for arg in "$@"; do
	case "$arg" in
		--reload) RELOAD=1 ;;
		--no-metro) START_METRO=0 ;;
		-h | --help)
			sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
			exit 0
			;;
		*)
			echo "unknown option: $arg (try --help)" >&2
			exit 2
			;;
	esac
done

step() { printf '\n=== %s\n' "$1"; }
die() {
	printf 'ERROR: %s\n' "$1" >&2
	exit 1
}

# ── 1. adb ────────────────────────────────────────────────────────────────────
step "Starting adb server"
adb start-server >/dev/null 2>&1 || die "could not start the adb server"

device_state() { adb -s "$DEVICE" get-state 2>/dev/null | tr -d '\r\n'; }

# ── 2. emulator ───────────────────────────────────────────────────────────────
if [ "$(device_state)" = "device" ]; then
	step "Emulator $DEVICE is already running"
else
	step "Starting $AVD (visible window), logging to $EMULATOR_LOG"
	[ -x "$EMULATOR" ] || die "emulator binary not found under $SDK"
	("$EMULATOR" -avd "$AVD" -no-snapshot-load >"$EMULATOR_LOG" 2>&1 &)
fi

# `get-state == device` is the transport coming up, which is well before the
# package manager is. `sys.boot_completed == 1` is the flag that means `am start`
# will actually resolve — waiting on the first one and launching on it is how a
# launch lands mid-boot and is reported as an ANR.
step "Waiting for $DEVICE to finish booting"
BOOTED=0
for _ in $(seq 1 90); do
	if [ "$(adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')" = "1" ]; then
		BOOTED=1
		break
	fi
	sleep 2
done
[ "$BOOTED" = "1" ] || die "$DEVICE did not finish booting (see $EMULATOR_LOG)"
echo "booted"

# ── 3. Metro ──────────────────────────────────────────────────────────────────
metro_up() {
	[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$METRO_PORT/status" 2>/dev/null)" = "200" ]
}

if metro_up; then
	step "Metro already serving on http://localhost:$METRO_PORT"
elif [ "$START_METRO" = "1" ]; then
	step "Starting Metro on port $METRO_PORT, logging to $METRO_LOG"
	(cd "$MOBILE_DIR" && pnpm exec expo start --port "$METRO_PORT" >"$METRO_LOG" 2>&1 &)
	for _ in $(seq 1 60); do
		metro_up && break
		sleep 2
	done
	metro_up || die "Metro never answered on port $METRO_PORT (see $METRO_LOG)"
	echo "Metro listening"
else
	echo "NOTE: Metro is not running and --no-metro was given; the app will fail to load its bundle"
fi

# ── 4. adb reverse ────────────────────────────────────────────────────────────
# Verified through `--list` rather than the exit code, because `adb reverse`
# prints nothing useful on failure and a stale registration from a previous
# emulator looks identical to a live one from the caller's side.
step "Forwarding device port $METRO_PORT to the host"
adb -s "$DEVICE" reverse "tcp:$METRO_PORT" "tcp:$METRO_PORT" >/dev/null 2>&1
if adb -s "$DEVICE" reverse --list 2>/dev/null | grep -q "tcp:$METRO_PORT"; then
	echo "adb reverse tcp:$METRO_PORT tcp:$METRO_PORT is registered"
else
	die "adb reverse did not register (device: $DEVICE)"
fi

# ── 5. launch ─────────────────────────────────────────────────────────────────
if [ "$RELOAD" = "1" ]; then
	step "Force-stopping $PKG for a cold load"
	adb -s "$DEVICE" shell am force-stop "$PKG" >/dev/null 2>&1
fi

step "Launching $ACTIVITY"
adb -s "$DEVICE" shell am start -n "$ACTIVITY" \
	-a android.intent.action.MAIN \
	-c android.intent.category.LAUNCHER >/dev/null 2>&1 ||
	die "am start failed — is $PKG installed? (rebuild with scripts/run-android.ps1 --build)"

# ── 6. verify ─────────────────────────────────────────────────────────────────
# The point of the check is that the activity is *focused*, not merely that
# `am start` exited 0: it exits 0 while the window manager is still on the
# launcher, and the load this script exists to avoid is exactly the one where
# the app is up but never gets the foreground.
step "Verifying"
FOCUS=""
for _ in $(seq 1 20); do
	FOCUS="$(adb -s "$DEVICE" shell dumpsys window 2>/dev/null | grep -m1 'mCurrentFocus' | tr -d '\r')"
	case "$FOCUS" in
		*"$PKG"*)
			echo "$FOCUS"
			echo "App is running and focused on $DEVICE"
			exit 0
			;;
	esac
	sleep 2
done

echo "last focus: ${FOCUS:-<none>}"
die "app never came to the foreground (it may have ANR'd — check: adb logcat | grep ReactNativeJS)"
