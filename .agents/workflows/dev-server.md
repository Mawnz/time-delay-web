---
description: How to start the development server for the time-delay project
---

# Dev Server Workflow

// turbo-all

## Web (browser development)

1. Open a terminal in the project root (`c:\Users\bomst\projects\time-delay`).

2. Start the dev server with hot reload:
   ```bash
   bun --hot server.ts
   ```
   The server runs on `http://localhost:3000`.

3. Open `http://localhost:3000` in Chrome (preferred for MSE compatibility).

4. To test on a mobile device via browser, run ngrok in a second terminal:
   ```bash
   ngrok http 3000
   ```
   Then open the provided `https://` URL on your phone.

> **Note:** Camera/microphone access requires HTTPS except on `localhost`. Always use the ngrok URL for mobile testing.

## Android (native)

1. Build and sync:
   ```bash
   npm run android
   ```
   This builds web assets to `dist/`, copies `index.html` and `styles.css`, and syncs to the Android project.

2. Android Studio will open. Click **Run** ▶ on a connected device or emulator.

3. For iterative web-only changes (no native code), re-run `npm run android` to sync updated assets.

4. For native Kotlin changes, rebuild directly in Android Studio (Build → Make Project, then Run).

> **Tip:** To speed up development, uncomment the `url: 'http://localhost:3000'` line in `capacitor.config.ts` to load web content from the Bun dev server instead of the bundled assets. Remember to comment it back out for production builds.
