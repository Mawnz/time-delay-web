---
description: How to debug MediaSource / SourceBuffer playback issues in the time-delay project
---

# Debug Playback Workflow

Use this workflow when you encounter playback failures, stuttering, or seeking errors.

## Common Symptoms & Root Causes

| Symptom | Likely Cause |
|---|---|
| Video never starts playing | Init segment not appended, or MediaSource not open |
| `InvalidStateError` on `appendBuffer` | Called while `sourceBuffer.updating === true` |
| Playback freezes after seek | Init segment not re-appended after `remove()` |
| `QuotaExceededError` | SourceBuffer full; need to remove old data first |
| `video.error` set | Fatal MSE error; inspect `video.error.code` |

## Step-by-Step Debug Process

1. **Open Chrome DevTools** → Console tab. Filter for errors.

2. **Check MediaSource state:**
   ```javascript
   // In console:
   window.__debugMediaSource?.readyState
   // Expected: 'open' during playback
   ```

3. **Check SourceBuffer state:**
   ```javascript
   window.__debugSourceBuffer?.updating
   // If true when it shouldn't be, an append is stuck
   ```

4. **Inspect buffered ranges:**
   ```javascript
   const sb = window.__debugSourceBuffer;
   for (let i = 0; i < sb.buffered.length; i++) {
     console.log(sb.buffered.start(i), '-', sb.buffered.end(i));
   }
   ```

5. **Check IndexedDB for stored chunks:**
   - DevTools → Application → IndexedDB → time-delay-db → chunks
   - Confirm timestamps match what the player is trying to fetch.

6. **Verify init segment exists:**
   - DevTools → Application → IndexedDB → time-delay-db → initSegment
   - Must contain exactly one entry with `key = "init"`.

7. **Force a fresh start:**
   - DevTools → Application → IndexedDB → Delete database
   - Reload, re-record, re-test.

## Adding Temporary Debug Logging

In `player.ts`, expose MSE objects to the console for inspection:
```typescript
(window as any).__debugMediaSource = this.mediaSource;
(window as any).__debugSourceBuffer = this.sourceBuffer;
```

Remove before committing.

## Reference

- Read `.agents/skills/media-source-api/SKILL.md` for the correct seeking and appending patterns.
- The `debug.txt` file in the project root contains example console output from a working session for reference.
