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
| Storage (new data type) | `db.ts` | `player.ts`, `main.ts` |
| Playback logic | `player.ts` | `main.ts` |
| Timeline rendering | `timeline-manager.ts` | `main.ts` |
| UI controls | `index.html` | `main.ts` |
| Annotations | `annotation.ts` | `main.ts` |
| Shared constants | `config.ts` | Any module |

## 3. Plan Before Coding

- Write down what state changes, what events are emitted, and what DOM updates occur.
- Confirm the MediaSource/SourceBuffer sequencing is correct (init segment → content chunks, queue-based appends).
- For timeline changes, confirm it respects zoom level and virtual rendering.

## 4. Implement

- Keep each module focused on its role.
- Add TypeScript types for any new data structures.
- Do not add inline styles; use Tailwind utility classes in `index.html`.

## 5. Test Manually

// turbo
1. Start dev server: `bun --hot server.ts`
2. Open `http://localhost:3000` in Chrome DevTools.
3. Grant camera permission and start recording.
4. Wait for the delay period, then verify the new feature.
5. Check the browser console for errors (especially MSE/IndexedDB errors).
6. Test seeking: drag the timeline to a past position and verify playback resumes correctly.
7. Test on mobile via ngrok if the feature involves touch or layout.
