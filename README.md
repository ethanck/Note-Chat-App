# Note App Chat

React Native / Expo rebuild of the Note App Chat iPhone experience.

The original Swift app is kept in its own folder. This repository is a separate implementation with a modular TypeScript UI, local-first data layer, and an iOS project that can be opened in Xcode.

## Current scope

- Chat workspace with multiple named conversations.
- Slide-out chat drawer with search, favorites, pinning, and archive/delete actions.
- Local notes with folders, nested folders, search, favorites, pinning, and a lightweight rich editor.
- Multiple local notebooks with an Add to Notes workflow.
- AI-generated quizzes from local notes with persisted scores.
- Hierarchical summary-first chat-to-notes organization. ChatGPT selects a likely folder branch, proposes append/create/split/link/rewrite actions, and the user accepts or declines a visible change preview before anything is written.
- Local attachment intake for TXT, Markdown, PDF, DOC/DOCX, and images. Files are copied into the app sandbox; supported files are sent as inline Responses API inputs only when the user sends them in a chat.
- Local SQLite persistence on the device.
- Sign in with ChatGPT OAuth using PKCE, ID-token/JWKS verification, SecureStore credentials, token refresh, model discovery, and Responses API requests when the user grants eligible ChatGPT plan usage.
- Firebase is intentionally not used for notes, folders, or chat content in this first version.

## Development

Use Node 20 for Expo and Xcode tooling. The version is pinned in `.nvmrc`; the machine's default Node version must not be used for CocoaPods or Expo autolinking. Keep one local checkout as the source of truth and open the `ios/NoteAppChat.xcworkspace` inside that same checkout.

```sh
nvm use
npm install
npm run start
```

In Settings, use **Continue with ChatGPT**. The app opens the system authentication session, requests the identity and ChatGPT-plan permissions separately, and stores the resulting credentials in the iOS Keychain through SecureStore. No API key is requested or stored. ChatGPT plan usage is only available to eligible accounts and does not provide access to the user's ChatGPT conversations.

For the native iOS project:

```sh
cd ios
pod install
open NoteAppChat.xcworkspace
```

The generated iOS project is checked in so it can be opened directly in Xcode. CocoaPods and Xcode may generate local build products that are intentionally ignored by Git.

## Testing

```sh
npx tsc --noEmit
npx expo-doctor
npm run web
```

The browser target is kept compatible with the same component and state architecture, while the first release is focused on iPhone.

## Device and TestFlight signing

Simulator builds do not require signing. A physical iPhone or TestFlight archive requires the developer to sign into Xcode with an Apple Developer account, select a team for the `com.ethankurtz.noteappchat` bundle identifier, and configure the normal Apple provisioning/App Store Connect settings. No Apple signing credentials are stored in this repository.

## Planned integrations

- Firebase Authentication for the single account session.
- Optional Firebase sync for app metadata after local-first behavior is validated.
- iOS share-sheet ingestion for chats copied from other AI apps.
- Browser deployment after the iPhone workflow is stable.
