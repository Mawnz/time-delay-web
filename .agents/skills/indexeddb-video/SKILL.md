# Storage: SQLite Implementation (Time Delay)

Patterns for persistent session and video metadata storage in React Native using `react-native-sqlite-storage`.

## Schema Design
Metadata is stored in a central SQLite database to track recording sessions and their associated segments, thumbnails, and annotations.

### 1. Sessions
- `id`: Unique session identifier (timestamp).
- `name`: User-defined session name.

### 2. Segments
- `id`: Segment identifier.
- `sessionId`: Associated session.
- `timestamp`: Absolute start time (ms).
- `duration`: Length in seconds.
- `path`: Local file system URI.

### 3. Thumbnails
- `id`: Thumbnail identifier.
- `sessionId`: Associated session.
- `timestamp`: Point in time relative to session start.
- `path`: Local URI to PNG/JPG.

### 4. Annotations
- `id`: Annotation identifier.
- `sessionId`: Associated session.
- `timestamp`: Point in time relative to session start.
- `data`: JSON string of drawing paths.

## Key Patterns
- **Asynchronous Initialization**: Ensure `initDB()` is called before any recording or playback operations.
- **Batched Retrieval**: Use `getThumbnails(sessionId, start, end)` to efficiently populate the timeline as the user scrolls.
- **Cleanup**: Implement logic to delete old MP4 segments and their metadata when a session is deleted to free up device storage.
