---
name: indexeddb-video
description: Patterns for working with the IndexedDB video storage layer in the time-delay project (db.ts). Use this skill when reading or modifying db.ts, or when adding new data types that need persistence.
---

# Skill: IndexedDB Video Chunk Storage

## Database Schema (db.ts)

All data is stored in a single IndexedDB database. The object stores are:

| Store | Key | Contents |
|---|---|---|
| `chunks` | `timestamp` (ms, auto) | `{ timestamp, data: Blob }` — raw MediaRecorder chunks |
| `initSegment` | singleton (`"init"`) | `{ data: Blob }` — first MediaRecorder blob (codec metadata) |
| `sessions` | `name` (string) | `{ name, createdAt, chunks: [...] }` — saved sessions |
| `thumbnails` | `timestamp` | `{ timestamp, dataUrl: string }` — video frame snapshots |
| `annotations` | `timestamp` | `{ timestamp, strokes: [...] }` — canvas drawing data |

## Key Operations

### Save a chunk
```typescript
await db.saveChunk(blob: Blob); // stores with Date.now() timestamp
```

### Save init segment (called once, for the first chunk)
```typescript
await db.saveInitSegment(blob: Blob);
```

### Fetch chunks by time range
```typescript
const chunks = await db.getChunksInRange(startMs: number, endMs: number);
// Returns: Array<{ timestamp: number, data: ArrayBuffer }>
```

### Fetch all chunks from a start time (for seeking)
```typescript
const chunks = await db.getChunksFrom(startMs: number);
```

## Timestamp Convention

- All timestamps are **milliseconds since epoch** (`Date.now()`).
- When calculating playback delay: `playbackThreshold = Date.now() - delayMs`.
- Fetch only chunks with `timestamp <= playbackThreshold`.

## Adding a New Object Store

1. Increment the DB version in `db.ts`.
2. Add the store inside the `onupgradeneeded` handler:
   ```typescript
   db.createObjectStore('myStore', { keyPath: 'id' });
   ```
3. Add typed read/write methods following the existing async/await + IDBRequest pattern.

## iOS/Safari Caveat

- Safari has strict IndexedDB Blob size limits.
- For Capacitor (mobile native) builds: store Blobs on the filesystem via `@capacitor/filesystem` and save only the file path in IndexedDB.
- The `db.ts` abstraction should be designed to support this swap cleanly.
