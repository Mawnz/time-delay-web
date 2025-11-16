export async function generateThumbnail(videoElement: HTMLVideoElement): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                resolve(dataUrl);
            } else {
                reject('Could not get canvas context');
            }
        } catch (error) {
            reject(error);
        }
    });
}
