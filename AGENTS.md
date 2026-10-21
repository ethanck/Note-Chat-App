# Agent instructions

## Project

- This is a modular Expo/React Native app for iPhone, with browser support planned.
- The app uses custom navigation in `App.tsx` and `src/screens/`; it does not use Expo Router.
- Keep the original Swift app separate and unchanged.
- Keep notes, folders, chats, and imported files local-first. Firebase is planned but not active.

## Development

- Use Node 20 (`.nvmrc`) and npm. Keep `package-lock.json` synchronized with `package.json`.
- Before using an Expo or React Native API, verify it against Expo SDK 57 documentation.
- Prefer Expo-supported modules and keep UI, state, storage, and service code modular.
- Browser exports require `react-dom` and `react-native-web`; `metro.config.js` keeps Expo SQLite's WebAssembly asset available to the web worker.
- Document durable architectural decisions briefly in code or `README.md`.

## Native iOS

- The checked-in native project is intentional. Open `ios/NoteAppChat.xcworkspace`, not the `.xcodeproj`.
- Run `npm run ios:pods` after native dependency changes.
- A local, non-synced checkout may be needed because Xcode can hang while scanning the synced `Documents/GitHub` folder.
- Never commit `node_modules`, `ios/Pods`, build products, signing credentials, or local environment files.

## Verification

- Test incrementally while implementing changes.
- Before declaring work complete, run `npm run typecheck`, `npx expo-doctor`, and the relevant iOS or web build/check.
- Use `apply_patch` for source edits and preserve unrelated user changes.
