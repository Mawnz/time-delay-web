---
description: How to start the development server for the time-delay project
---

# Dev Server Workflow

// turbo-all

1. Open a terminal in the project root (`c:\Users\bomst\projects\time-delay`).

2. Start the dev server with hot reload:
   ```bash
   bun --hot server.ts
   ```
   The server runs on `http://localhost:3000`.

3. Open `http://localhost:3000` in Chrome or Firefox (Chrome preferred for MediaSource API compatibility).

4. To test on a mobile device, run ngrok in a second terminal:
   ```bash
   ngrok http 3000
   ```
   Then open the provided `https://` URL on your phone.

> **Note:** Camera/microphone access requires HTTPS except on `localhost`. Always use the ngrok URL for mobile testing.
