/**
 * Storage adapter — abstracts the difference between:
 *   - Native: video segments stored as files on the local filesystem
 *   - Web: video chunks stored as Blobs in IndexedDB
 *
 * This module provides a unified `readSegment()` function that returns
 * an ArrayBuffer regardless of the storage backend.
 */
import { isNative } from './platform';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface SegmentRef {
    /** Native: absolute file path. Web: unused. */
    filePath?: string;
    /** Web fallback: Blob stored in IDB. Native: unused. */
    data?: Blob;
    /** Timestamp of this segment (ms since epoch). */
    timestamp: number;
}

/**
 * Read a segment's binary data as an ArrayBuffer.
 *
 * On native, reads the file from disk via Capacitor Filesystem.
 * On web, converts the IDB Blob to an ArrayBuffer.
 */
export async function readSegment(ref: SegmentRef): Promise<ArrayBuffer> {
    if (isNative() && ref.filePath) {
        return readNativeFile(ref.filePath);
    } else if (ref.data) {
        return ref.data.arrayBuffer();
    }
    throw new Error('SegmentRef has no readable data');
}

/**
 * Read a native file by absolute path and return its contents as an ArrayBuffer.
 */
export async function readNativeFile(path: string): Promise<ArrayBuffer> {
    let fileUri = path;
    if (!fileUri.startsWith('file://')) {
        fileUri = 'file://' + fileUri;
    }

    const result = await Filesystem.readFile({
        path: fileUri
    });

    // Filesystem.readFile returns base64 by default
    if (typeof result.data === 'string') {
        return base64ToArrayBuffer(result.data);
    }
    // If it returns a Blob (newer Capacitor versions)
    if (result.data instanceof Blob) {
        return result.data.arrayBuffer();
    }
    throw new Error('Unexpected Filesystem.readFile result type');
}

/**
 * Convert a base64 string to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Strip data URL prefix if present
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
