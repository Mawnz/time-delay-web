---
description: How to add a new feature to the time-delay codebase safely
---

# Add Feature Workflow

Follow these steps in order when implementing any new feature.

## 1. Check Relevant Skills

Before writing code, check if a skill applies to your change:

- Modifying `player.ts` or MSE/SourceBuffer logic → Read `.agents/skills/media-source-api/SKILL.md`
- Modifying `db.ts` or adding new stored data → Read `.agents/skills/indexeddb-video/SKILL.md`
- Modifying `timeline-manager.ts`, zoom, or thumbnail rendering → Read `.agents/skills/timeline-virtualization/SKILL.md`

## 2. Identify the Affected Modules

| Change type | Primary file | Wired in |
|---|---|---|
| Capture/camera settings | `camera.ts` | `main.ts` |
| Native camera behavior | `CameraRecorderPlugin.kt` | `camera.ts` via Capacitor bridge |
| Storage (new data type) | `db.ts` | `player.ts`, `main.ts` |
| Playback logic | `player.ts` | `main.ts` |
| Timeline rendering | `timeline-manager.ts` | `main.ts` |
| UI controls | `index.html` | `main.ts` |
| Annotations | `annotation.ts` | `main.ts` |
| Shared constants | `config.ts` | Any module |
| Platform detection | `platform.ts` | `camera.ts`, `config.ts`, `player.ts` |
| Segment I/O | `storage-adapter.ts` | `player.ts` |

## 3. Consider the Dual-Path Architecture

This project has **two code paths** — native (Android/Capacitor) and web (browser).

- **Always check if your change needs to work on both paths.** Use `isNative()` / `isWeb()` from `platform.ts` to branch.
- If adding a new feature that involves camera/storage, decide: web-only, native-only, or both?
- Native camera changes require Kotlin code in `android/app/.../plugins/camera/`.
- Web camera changes stay in `camera.ts`.
- Player/timeline/annotation changes generally work for both paths (they consume data from `storage-adapter.ts`).

## 4. Plan Before Coding

- Write down what state changes, what events are emitted, and what DOM updates occur.
- Confirm the MediaSource/SourceBuffer sequencing is correct (init segment → content chunks, queue-based appends).
- For native changes, verify the Capacitor bridge contract (method signatures, event payloads).
- For timeline changes, confirm it respects zoom level and virtual rendering.

## 5. Implement

- Keep each module focused on its role.
- Add TypeScript types for any new data structures.
- Style changes go in `styles.css` (vanilla CSS, no Tailwind).
- Native code goes in the `android/` directory, following existing Kotlin patterns.

## 6. Test

// turbo
1. **Web**: Start dev server: `bun --hot server.ts`
2. Open `http://localhost:3000` in Chrome DevTools.
3. Grant camera permission and start recording.
4. Wait for the delay period, then verify the new feature.
5. Check the browser console for errors (especially MSE/IndexedDB errors).
6. Test seeking: drag the timeline to a past position and verify playback resumes correctly.
7. **Android**: Run `npm run android`, then test on a real device. Check Android Studio Logcat for native errors (filter by `CameraRecorderPlugin` or `SegmentWriter`).
8. Test on mobile via ngrok if the feature involves touch or layout.
