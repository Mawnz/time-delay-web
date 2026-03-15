// FIX R5: Cap thumbnail canvas to 160×90 and use JPEG quality 0.7.
// This reduces per-thumbnail size from ~100KB to ~5–8KB — roughly a 12× saving.
// For a 60-minute session this drops thumbnail storage from ~360MB to ~30MB.

const THUMB_MAX_WIDTH = 160;
const THUMB_MAX_HEIGHT = 90;
const THUMB_QUALITY = 0.7;

export async function generateThumbnail(videoElement: HTMLVideoElement): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const srcW = videoElement.videoWidth || THUMB_MAX_WIDTH;
            const srcH = videoElement.videoHeight || THUMB_MAX_HEIGHT;

            // Scale to fit within max dimensions, preserving aspect ratio
            const scale = Math.min(THUMB_MAX_WIDTH / srcW, THUMB_MAX_HEIGHT / srcH);
            const w = Math.round(srcW * scale);
            const h = Math.round(srcH * scale);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoElement, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', THUMB_QUALITY);
                resolve(dataUrl);
            } else {
                reject('Could not get canvas context');
            }
        } catch (error) {
            reject(error);
        }
    });
}
