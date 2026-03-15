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
| `QuotaExceededError` | SourceBuffer full; trimBuffer() may not be aggressive enough |
| `video.error` set | Fatal MSE error; inspect `video.error.code` |
| Native segments don't play | Codec mismatch — check `config.ts` MIME type vs actual segment format |
| Segments not fetching | `storage-adapter.ts` failing to read native files; check Capacitor Filesystem permissions |

## Step-by-Step Debug Process

### 1. Determine Which Path Is Active

Check `platform.ts`:
- **Native (Android)**: Segments are `.mp4` files, codec is `avc1.42E01E`, SourceBuffer mode is `segments`
- **Web (browser)**: Chunks are IDB Blobs, codec is `vp8`, SourceBuffer mode is `sequence`

### 2. Check MediaSource State

```javascript
// In Chrome DevTools console:
document.getElementById('delayed').src  // Should be a blob: URL
```

### 3. Inspect Buffered Ranges

```javascript
const v = document.getElementById('delayed');
for (let i = 0; i < v.buffered.length; i++) {
  console.log(`Buffered range ${i}: ${v.buffered.start(i)}s - ${v.buffered.end(i)}s`);
}
console.log('currentTime:', v.currentTime);
```

### 4. Check Buffer Trimming

`player.ts` trims content >30s behind the playhead. If seeking far back, the trimmed data must be re-fetched from storage. Check if `getSegmentsAfter()` returns the expected segments.

### 5. Check Storage (Web Path)

- **DevTools → Application → IndexedDB → time-delay-db**
- `chunks` store: should have entries with `data` (Blob) or `filePath` (string)
- `initializationSegments` store: should have one entry per session

### 6. Check Storage (Native Path)

On Android, use Android Studio:
```bash
# In Android Studio terminal or Device File Explorer:
# Navigate to /data/data/com.timedelay.app/files/sessions/{sessionId}/
# Should contain: init.mp4, segment_0001.mp4, segment_0002.mp4, ...
```

Or check Logcat for `SegmentWriter` / `CameraRecorderPlugin` tags.

### 7. Check Codec Compatibility

```javascript
MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')  // Native path
MediaSource.isTypeSupported('video/webm; codecs="vp8"')          // Web path
```

### 8. Force a Fresh Start

- **Web**: DevTools → Application → IndexedDB → Delete database → Reload
- **Android**: App Info → Clear Data → Re-open app

## Adding Temporary Debug Logging

In `player.ts`, expose MSE objects to the console for inspection:
```typescript
(window as any).__debugMediaSource = this.mediaSource;
(window as any).__debugSourceBuffer = this.sourceBuffer;
```

Remove before committing.

## Reference

- Read `.agents/skills/media-source-api/SKILL.md` for the correct seeking and appending patterns.
- The `debug.txt` file in the project root contains example console output from a working session.
