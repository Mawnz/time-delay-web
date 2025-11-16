import { Camera } from './camera';
import { Player } from './player';
import { DB } from './db';
import { Annotation } from './annotation';

const liveVideoElement = document.getElementById('video') as HTMLVideoElement;
const delayedVideoElement = document.getElementById('delayed') as HTMLVideoElement;
const toggleButton = document.getElementById('toggle') as HTMLButtonElement;
toggleButton.disabled = true;
toggleButton.textContent = 'Loading...';

const db = new DB('time-delay-db');
let camera: Camera;
let player: Player;
let annotation: Annotation;
let currentSessionId: string | null = null;

const annotationCanvas = document.getElementById('annotation-canvas') as HTMLCanvasElement;
const clearButton = document.getElementById('clear') as HTMLButtonElement;
const playPauseButton = document.getElementById('play-pause') as HTMLButtonElement;
const slowMotionButton = document.getElementById('slow-motion') as HTMLButtonElement;
const frameBackwardButton = document.getElementById('frame-backward') as HTMLButtonElement;
const frameForwardButton = document.getElementById('frame-forward') as HTMLButtonElement;
const sessionsButton = document.getElementById('sessions') as HTMLButtonElement;
const sessionsModal = document.getElementById('sessions-modal') as HTMLDivElement;
const sessionsList = document.getElementById('sessions-list') as HTMLUListElement;
const closeSessionsButton = document.getElementById('close-sessions') as HTMLButtonElement;
const importSessionButton = document.getElementById('import-session') as HTMLButtonElement;
const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;

let isCameraStarted = false;

window.addEventListener('load', async () => {
    await db.open();
    toggleButton.disabled = false;
    toggleButton.textContent = 'Start Camera';
    annotation = new Annotation(annotationCanvas);
    annotation.onDrawingEnd = (data) => {
        if (currentSessionId) {
            db.addAnnotation(currentSessionId, delayedVideoElement.currentTime, data);
        }
    };
    delayedVideoElement.addEventListener('seeked', () => {
        if (delayedVideoElement.paused && currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    });
    loadSessionsList();
});

async function loadAnnotations(sessionId: string, timestamp: number) {
    await db.getAnnotationsForTimestamp(sessionId, timestamp, (annotations) => {
        annotation.clear();
        if (annotations.length > 0) {
            // For simplicity, load the first annotation found at this timestamp
            annotation.loadDrawingData(annotations[0].data);
        }
    });
}

async function loadSessionsList() {
    await db.getAllSessions(sessions => {
        sessionsList.innerHTML = '';
        sessions.forEach(session => {
            const li = document.createElement('li');
            li.className = 'p-2 hover:bg-gray-700 flex justify-between items-center';
            
            const sessionInfo = document.createElement('span');
            sessionInfo.className = 'cursor-pointer';
            sessionInfo.textContent = `${session.name} - ${new Date(session.createdAt).toLocaleString()}`;
            sessionInfo.dataset.sessionId = session.id;
            
            const exportButton = document.createElement('button');
            exportButton.className = 'bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded';
            exportButton.textContent = 'Export';
            exportButton.dataset.exportSessionId = session.id;

            li.appendChild(sessionInfo);
            li.appendChild(exportButton);
            sessionsList.appendChild(li);
        });
    });
}

sessionsButton?.addEventListener('click', () => {
    sessionsModal.classList.remove('hidden');
});

closeSessionsButton?.addEventListener('click', () => {
    sessionsModal.classList.add('hidden');
});

importSessionButton?.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                await importSession(data);
                sessionsModal.classList.add('hidden');
            } catch (error) {
                console.error('Error importing session:', error);
                alert('Failed to import session. Invalid file format.');
            }
        };
        reader.readAsText(file);
    }
});

async function importSession(data: any) {
    console.log('Importing session...');
    const newSessionId = Date.now().toString();
    const newSession = {
        id: newSessionId,
        name: `(Imported) ${data.session.name}`,
        createdAt: new Date().getTime()
    };
    await db.addSession(newSession);

    const base64ToBlob = (base64: string) => fetch(base64).then(res => res.blob());

    for (const chunk of data.chunks) {
        const blob = await base64ToBlob(chunk.data);
        await db.addChunk(newSessionId, blob);
    }

    for (const thumbnail of data.thumbnails) {
        await db.addThumbnail(newSessionId, thumbnail.data);
    }

    for (const annotation of data.annotations) {
        await db.addAnnotation(newSessionId, annotation.timestamp, annotation.data);
    }

    loadSessionsList();
    console.log('Import complete');
}

sessionsList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.sessionId) {
        currentSessionId = target.dataset.sessionId;
        if (isCameraStarted) {
            camera.stop();
            isCameraStarted = false;
            toggleButton.textContent = 'Start Camera';
        }
        player = new Player(delayedVideoElement, db, currentSessionId);
        const thumbnailTimeline = document.getElementById('thumbnail-timeline') as HTMLDivElement;
        thumbnailTimeline.innerHTML = '';
        player.start();
        sessionsModal.classList.add('hidden');
    } else if (target.dataset.exportSessionId) {
        exportSession(target.dataset.exportSessionId);
    }
});

async function exportSession(sessionId: string) {
    console.log(`Exporting session: ${sessionId}`);
    try {
        const [session, chunks, thumbnails, annotations] = await Promise.all([
            db.getSession(sessionId),
            db.getAllChunksForSession(sessionId),
            db.getAllThumbnailsForSession(sessionId),
            db.getAllAnnotationsForSession(sessionId)
        ]);

        const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const chunksAsBase64 = await Promise.all(chunks.map(c => blobToBase64(c.data)));

        const exportData = {
            session,
            chunks: chunks.map((c, i) => ({ ...c, data: chunksAsBase64[i] })),
            thumbnails,
            annotations
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Export complete');

    } catch (error) {
        console.error('Export failed:', error);
    }
}

toggleButton?.addEventListener('click', async () => {
    if (isCameraStarted) {
        if (camera) camera.stop();
        toggleButton.textContent = 'Start Camera';
        isCameraStarted = false;
    } else {
        const sessionName = prompt("Enter session name:", `Session ${new Date().toLocaleString()}`);
        if (sessionName) {
            currentSessionId = Date.now().toString();
            await db.addSession({ id: currentSessionId, name: sessionName, createdAt: Date.now() });
            loadSessionsList();

            camera = new Camera(liveVideoElement, db, currentSessionId);
            player = new Player(delayedVideoElement, db, currentSessionId);
            
            const thumbnailTimeline = document.getElementById('thumbnail-timeline') as HTMLDivElement;
            thumbnailTimeline.innerHTML = '';

            await camera.start();
            player.start();
            toggleButton.textContent = 'Stop Camera';
            isCameraStarted = true;
        }
    }
});

clearButton?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all data?')) {
        await db.clear();
        window.location.reload();
    }
});

playPauseButton?.addEventListener('click', () => {
    if (player) {
        player.togglePlayPause();
        if (delayedVideoElement.paused) {
            annotation.enableDrawing();
            if (currentSessionId) {
                loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
            }
        } else {
            annotation.disableDrawing();
            annotation.clear();
        }
    }
});

slowMotionButton?.addEventListener('click', () => {
    if (player) player.toggleSlowMotion();
});

frameBackwardButton?.addEventListener('click', () => {
    if (player) {
        player.frameStep('backward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});

frameForwardButton?.addEventListener('click', () => {
    if (player) {
        player.frameStep('forward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});
