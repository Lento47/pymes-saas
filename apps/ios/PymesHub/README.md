# PymesHub iOS

SwiftUI iOS app scaffold for PymesHub.

## Requirements

- Xcode 16 or newer
- iOS 17 deployment target
- A reachable PymesHub API URL, for example `https://api.pymeshub.com`

## Local Setup

1. Open `PymesHub.xcodeproj` in Xcode.
2. Select the `PymesHub` scheme.
3. Update signing team and bundle identifier if needed.
4. Build and run on an iOS 17+ simulator.

## Runtime Configuration

The app reads its default API base URL from `Resources/Configuration.plist`:

```xml
<key>API_BASE_URL</key>
<string>http://localhost:4000</string>
```

For simulator testing against the local API, use `http://localhost:4000` if the API is running on the same Mac. For a physical device, use the LAN-accessible host or a staging HTTPS URL.

## Scope

This app currently includes:

- Login with email, password, and workspace slug
- Keychain-backed refresh token storage
- In-memory access token
- Automatic refresh on `401`
- Authenticated shell with Inbox, Contacts, Tasks, Invoices, and Settings tabs
- Initial API wiring for the MVP endpoints documented in `docs/ios-app`

No GitHub push has been performed.
