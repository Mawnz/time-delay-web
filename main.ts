import { Camera } from './camera';
import { Player } from './player';
import { DB } from './db';
import { Annotation } from './annotation';

const liveVideoElement = document.getElementById('video') as HTMLVideoElement;
const delayedVideoElement = document.getElementById('delayed') as HTMLVideoElement;
const toggleButton = document.getElementById('toggle') as HTMLButtonElement;
const recordingIndicator = document.getElementById('recording-indicator') as HTMLDivElement;

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
const toggleLoopButton = document.getElementById('toggle-loop') as HTMLButtonElement;
const exportClipButton = document.getElementById('export-clip') as HTMLButtonElement;
const lineColorInput = document.getElementById('line-color') as HTMLInputElement;
const lineWidthInput = document.getElementById('line-width') as HTMLInputElement;
const undoAnnotationButton = document.getElementById('undo-annotation') as HTMLButtonElement;
const redoAnnotationButton = document.getElementById('redo-annotation') as HTMLButtonElement;

let isCameraStarted = false;

window.addEventListener('load', async () => {
    await db.open();
    toggleButton.disabled = false;
    toggleButton.innerHTML = '<i class="fas fa-video"></i> Start Recording';
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

    // Update play/pause icon on video events
    delayedVideoElement.addEventListener('play', () => {
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    });
    delayedVideoElement.addEventListener('pause', () => {
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    });

    loadSessionsList();

    // Annotation tool event listeners
    lineColorInput.addEventListener('input', (e) => {
        annotation.setLineColor((e.target as HTMLInputElement).value);
    });
    lineWidthInput.addEventListener('input', (e) => {
        annotation.setLineWidth(parseInt((e.target as HTMLInputElement).value));
    });
    undoAnnotationButton.addEventListener('click', () => {
        annotation.undo();
    });
    redoAnnotationButton.addEventListener('click', () => {
        annotation.redo();
    });

    // Draggable Loop Selector Logic
    const timelineRangeHighlight = document.getElementById('timeline-range-highlight') as HTMLDivElement;
    const thumbnailTimeline = document.getElementById('thumbnail-timeline') as HTMLDivElement;

    let isDragging = false;

    Array.from(timelineRangeHighlight.children).forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            activeHandle = (e.target as HTMLElement).classList.contains('left') ? 'left' : 'right';
            startX = e.clientX;
            startLeft = timelineRangeHighlight.offsetLeft;
            startWidth = timelineRangeHighlight.offsetWidth;
        });
    });

    window.addEventListener('mousemove', (e) => {
        if (!player || (!isDragging && !isResizing)) return;
        e.preventDefault();

        const seekableEnd = delayedVideoElement.seekable.end(delayedVideoElement.seekable.length - 1);
        if (!isFinite(seekableEnd) || seekableEnd === 0) return;

        const timelineRect = thumbnailTimeline.getBoundingClientRect();
        const scrollWidth = thumbnailTimeline.scrollWidth;
        const dx = e.clientX - startX;

        if (isDragging) {
            const newLeft = Math.max(0, Math.min(startLeft + dx, scrollWidth - timelineRangeHighlight.offsetWidth));
            const newStartPercentage = newLeft / scrollWidth;
            const newEndPercentage = (newLeft + timelineRangeHighlight.offsetWidth) / scrollWidth;
            
            player.setPointA(newStartPercentage * seekableEnd);
            player.setPointB(newEndPercentage * seekableEnd);
        } else if (isResizing) {
            if (activeHandle === 'left') {
                const newWidth = Math.max(20, startWidth - dx);
                const newLeft = Math.max(0, startLeft + dx);
                const newStartPercentage = newLeft / scrollWidth;
                player.setPointA(newStartPercentage * seekableEnd);
            } else if (activeHandle === 'right') {
                const newWidth = Math.max(20, startWidth + dx);
                const newEndPercentage = (startLeft + newWidth) / scrollWidth;
                player.setPointB(newEndPercentage * seekableEnd);
            }
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        activeHandle = null;
    });
});

async function loadAnnotations(sessionId: string, timestamp: number) {
    await db.getAnnotationsForTimestamp(sessionId, timestamp, (annotations) => {
        annotation.clear();
        if (annotations.length > 0) {
            // Load all annotations for this timestamp as a drawing history
            annotation.loadDrawingData(annotations);
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
            exportButton.className = 'bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded ml-2';
            exportButton.innerHTML = '<i class="fas fa-download"></i> Export';
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

    for (const annotationEntry of data.annotations) {
        // annotationEntry.data is now an array of drawing history entries
        for (const drawingHistoryEntry of annotationEntry.data) {
            await db.addAnnotation(newSessionId, annotationEntry.timestamp, drawingHistoryEntry);
        }
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
            toggleButton.innerHTML = '<i class="fas fa-video"></i> Start Recording';
            recordingIndicator.style.display = 'none';
        }
        player = new Player(delayedVideoElement, db, currentSessionId);
        const thumbnailTimeline = document.getElementById('thumbnail-timeline') as HTMLDivElement;
        thumbnailTimeline.querySelectorAll('img').forEach(img => img.remove()); // Clear only thumbnails
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
        toggleButton.innerHTML = '<i class="fas fa-video"></i> Start Recording';
        recordingIndicator.style.display = 'none';
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
            thumbnailTimeline.querySelectorAll('img').forEach(img => img.remove()); // Clear only thumbnails
            
            await camera.start();
            player.start();

            toggleButton.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Recording';
            recordingIndicator.style.display = 'block';
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

toggleLoopButton?.addEventListener('click', () => {
    if (player) {
        player.toggleLoop();
        if (player.loopEnabled) {
            toggleLoopButton.classList.add('bg-teal-400'); // Highlight when active
        } else {
            toggleLoopButton.classList.remove('bg-teal-400');
        }
    }
});

exportClipButton?.addEventListener('click', async () => {
    if (!player || player.pointA === null || player.pointB === null) {
        alert('Please set both A and B points to export a clip.');
        return;
    }

    console.log('Exporting clip...');
    try {
        const clipData = await player.getClipData(player.pointA, player.pointB);
        
        const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const chunksAsBase64 = await Promise.all(clipData.chunks.map(c => blobToBase64(c.data)));

        const exportObject = {
            chunks: clipData.chunks.map((c, i) => ({ ...c, data: chunksAsBase64[i] })),
            thumbnails: clipData.thumbnails,
            annotations: clipData.annotations
        };

        const json = JSON.stringify(exportObject, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clip-${player.pointA}-${player.pointB}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Clip export complete');

    } catch (error) {
        console.error('Clip export failed:', error);
        alert('Failed to export clip. See console for details.');
    }
});

frameBackwardButton?.addEventListener('click', () => {
    if (player) {
        player.userPaused = true; // Pause when stepping
        player.frameStep('backward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});

frameForwardButton?.addEventListener('click', () => {
    if (player) {
        player.userPaused = true; // Pause when stepping
        player.frameStep('forward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});
