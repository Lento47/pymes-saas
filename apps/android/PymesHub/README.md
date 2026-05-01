# PymesHub Android

Jetpack Compose Android app scaffold for PymesHub.

## Requirements

- Android Studio Panda 3 / recent Android Studio
- JDK 17
- Android SDK 36
- Gradle 9.3.1 or Android Studio's bundled Gradle support

## Local Setup

1. Open `apps/android/PymesHub` in Android Studio.
2. Let Android Studio sync Gradle.
3. Confirm `app/src/main/res/values/config.xml` points to the API URL needed for your environment.
4. Run the `app` configuration on an emulator or device.

The current default is:

```xml
<string name="api_base_url">https://api.pymeshub.lat</string>
```

For emulator testing against an API running on the same development machine, use:

```xml
<string name="api_base_url">http://10.0.2.2:4000</string>
```

For a physical device, use a LAN-accessible host or HTTPS staging URL.

## Scope

This app currently includes:

- Login with email, password, and workspace slug
- Android Keystore-backed encrypted refresh token storage
- In-memory access token
- Automatic refresh on `401`
- Authenticated tabs for Inbox, Contacts, Tasks, Invoices, and Settings
- API wiring checked against `origin/main-api` for auth, conversations, messages, contacts, tasks, invoices, and notifications

No GitHub push has been performed.
