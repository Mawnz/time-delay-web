// This file contains shared configuration variables for the application.

// NOTE: We use video-only (no audio) for MediaSource compatibility.
// WebM chunks with an audio track (vp8, opus) cause timestamp handling issues
// in Chrome's MSE SourceBuffer.sequence mode, preventing chunks from being
// appended past the first one. Audio recording via getUserMedia is still
// captured by camera.ts but is not used in the MSE pipeline.
export const MIME_TYPE = 'video/webm; codecs="vp8"';
