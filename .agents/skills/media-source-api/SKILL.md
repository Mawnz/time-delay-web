---
name: media-source-api
description: Patterns for safely managing the MediaSource API and SourceBuffer in the time-delay project. Use this skill when modifying player.ts or anything that touches MSE playback, seeking, or buffer management.
---

# Skill: MediaSource API & SourceBuffer Management

## Core Invariants

1. **Init segment first.** Before appending any content chunk, the initialization segment (codec/container metadata — the very first `dataavailable` blob from `MediaRecorder`) **must** be appended to the `SourceBuffer`. It is stored separately in IndexedDB.

2. **One append at a time.** The `SourceBuffer` rejects appends while `sourceBuffer.updating === true`. Always wait for the `updateend` event before the next `appendBuffer()` call.

3. **Queue-based appending.** Use an internal queue (array) of `ArrayBuffer`s. On each `updateend`, dequeue and append the next item. Never call `appendBuffer()` directly from outside the queue processor.

4. **Check `MediaSource.readyState`.** Only append when `mediaSource.readyState === 'open'`. Guard every operation.

## Seeking Pattern

```typescript
async function seekTo(timeSeconds: number) {
  // 1. Abort any in-progress append
  if (sourceBuffer.updating) sourceBuffer.abort();

  // 2. Remove all buffered content
  if (sourceBuffer.buffered.length > 0) {
    sourceBuffer.remove(0, Infinity);
    await waitForUpdateEnd(sourceBuffer);
  }

  // 3. Re-append init segment
  const initChunk = await db.getInitSegment();
  sourceBuffer.appendBuffer(initChunk);
  await waitForUpdateEnd(sourceBuffer);

  // 4. Fetch chunks from seek time and append
  const chunks = await db.getChunksFrom(timeSeconds);
  for (const chunk of chunks) {
    sourceBuffer.appendBuffer(chunk.data);
    await waitForUpdateEnd(sourceBuffer);
  }

  // 5. Set video currentTime
  videoElement.currentTime = timeSeconds;
}

function waitForUpdateEnd(sb: SourceBuffer): Promise<void> {
  return new Promise(resolve => sb.addEventListener('updateend', resolve, { once: true }));
}
```

## Error Handling

- Listen for `sourceBuffer.addEventListener('error', ...)` and `mediaSource.addEventListener('error', ...)`.
- On error: log state, attempt to re-open `MediaSource` if appropriate, or surface to user.
- `QuotaExceededError` on `appendBuffer` means the buffer is full — call `sourceBuffer.remove()` on old data before retrying.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Appending before `updateend` | Always queue; never call `appendBuffer` while `updating === true` |
| Forgetting init segment on seek | Always re-append init segment after remove() |
| `MediaSource` not open | Guard with `mediaSource.readyState === 'open'` check |
| `abort()` called while not updating | Wrap in `if (sourceBuffer.updating)` guard |
| `currentTime` set before buffer is populated | Set `currentTime` only after init + first content chunk appended |
