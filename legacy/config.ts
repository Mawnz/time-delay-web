// This file contains shared configuration variables for the application.
import { isNative } from './platform';

// Native produces fMP4 with H.264. Web fallback uses WebM VP8.
// NOTE: On Safari/iOS the web fallback should also use 'video/mp4; codecs="avc1.42E01E"'
// since Safari does not support WebM/VP8. That will be handled when iOS support is added.
export const MIME_TYPE = isNative()
    ? 'video/mp4; codecs="avc1.42E01E"'
    : 'video/webm; codecs="vp8"';
