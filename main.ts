import { Camera } from './camera';
import { Player } from './player';
import { DB } from './db';
import { Annotation } from './annotation';

// Define global FFmpeg types for TypeScript
declare const FFmpegWASM: {
    FFmpeg: any;
};

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

// --- HELPER: Manually convert Blob to Uint8Array ---
// This is more stable than using the FFmpegUtil fetchFile for dynamic blobs
const blobToUint8Array = async (blob: Blob): Promise<Uint8Array> => {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
};

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

    delayedVideoElement.addEventListener('play', () => {
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    });
    delayedVideoElement.addEventListener('pause', () => {
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    });

    loadSessionsList();

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

    // --- Loop / Timeline Logic ---
    const timelineWrapper = document.getElementById('timeline-wrapper') as HTMLDivElement;
    const timelineRangeHighlight = document.getElementById('timeline-range-highlight') as HTMLDivElement;

    let isDragging = false;
    let isResizing = false;
    let activeHandle: 'left' | 'right' | null = null;
    let startX = 0;
    let startLeft = 0;
    let startWidth = 0;

    function handleCreateLoop(event: MouseEvent | Touch) {
        event.preventDefault(); 

        if (!player || delayedVideoElement.seekable.length === 0) return;

        const seekableEnd = delayedVideoElement.seekable.end(delayedVideoElement.seekable.length - 1);
        if (!isFinite(seekableEnd) || seekableEnd === 0) return;

        const timelineRect = timelineWrapper.getBoundingClientRect();
        const clientX = (event as any).clientX || (event as Touch).clientX;
        const clickX = clientX - timelineRect.left;
        const scrollX = timelineWrapper.scrollLeft;
        
        const centerTime = player.timelineManager.pixelToTime(clickX + scrollX);

        const loopDuration = 5; 
        let pointA = centerTime - (loopDuration / 2);
        let pointB = centerTime + (loopDuration / 2);

        if (pointA < 0) {
            pointA = 0;
            pointB = Math.min(loopDuration, seekableEnd);
        }
        if (pointB > seekableEnd) {
            pointB = seekableEnd;
            pointA = Math.max(0, seekableEnd - loopDuration);
        }

        player.setPointA(pointA);
        player.setPointB(pointB);
        player.setLoop(true); 
        
        toggleLoopButton.classList.add('bg-sky-500');
        toggleLoopButton.classList.remove('bg-teal-600', 'hover:bg-teal-700');

        delayedVideoElement.currentTime = centerTime; 
        if (delayedVideoElement.paused) {
            player.togglePlayPause();
        }

        timelineRangeHighlight.style.pointerEvents = 'auto'; 
    }

    timelineWrapper.addEventListener('contextmenu', (e) => handleCreateLoop(e));

    let longPressTimer: number;
    timelineWrapper.addEventListener('touchstart', (e) => {
        longPressTimer = window.setTimeout(() => {
            if (e.touches.length === 1) { 
                handleCreateLoop(e.touches[0]);
            }
        }, 500); 
    }, { passive: true });

    timelineWrapper.addEventListener('touchend', () => clearTimeout(longPressTimer));
    timelineWrapper.addEventListener('touchmove', () => clearTimeout(longPressTimer));

    timelineRangeHighlight.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startLeft = timelineRangeHighlight.offsetLeft;
    });

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

    timelineRangeHighlight.addEventListener('dblclick', () => {
        if (player) {
            player.clearPoints();
            toggleLoopButton.classList.remove('bg-sky-500');
            toggleLoopButton.classList.add('bg-teal-600', 'hover:bg-teal-700');
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!player || (!isDragging && !isResizing)) return;
        e.preventDefault();

        const spacer = document.getElementById('timeline-spacer') as HTMLDivElement;
        const scrollWidth = spacer.offsetWidth; 
        const dx = e.clientX - startX;

        if (isDragging) {
            const newLeft = Math.max(0, Math.min(startLeft + dx, scrollWidth - timelineRangeHighlight.offsetWidth));
            const startTime = player.timelineManager.pixelToTime(newLeft);
            const duration = player.timelineManager.pixelToTime(timelineRangeHighlight.offsetWidth);
            
            player.setPointA(startTime);
            player.setPointB(startTime + duration);
        } else if (isResizing) {
            if (activeHandle === 'left') {
                const newLeft = Math.max(0, startLeft + dx);
                const startTime = player.timelineManager.pixelToTime(newLeft);
                player.setPointA(startTime);
            } else if (activeHandle === 'right') {
                const newWidth = Math.max(20, startWidth + dx);
                const newRight = startLeft + newWidth;
                const endTime = player.timelineManager.pixelToTime(newRight);
                player.setPointB(endTime);
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
            
            li.appendChild(sessionInfo);
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
        player.start();
        sessionsModal.classList.add('hidden');
    }
});

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
            toggleLoopButton.classList.add('bg-sky-500');
            toggleLoopButton.classList.remove('bg-teal-600', 'hover:bg-teal-700');
        } else {
            toggleLoopButton.classList.remove('bg-sky-500');
            toggleLoopButton.classList.add('bg-teal-600', 'hover:bg-teal-700');
        }
    }
});

// --- VIDEO EXPORT LOGIC (MEMORY MERGE STRATEGY) ---
exportClipButton?.addEventListener('click', async () => {
    if (!player || player.pointA === null || player.pointB === null || !currentSessionId) {
        alert('Please set both A and B points to export a clip.');
        return;
    }

    const btn = exportClipButton;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing...';
    btn.disabled = true;
    btn.classList.add('opacity-50');

    let ffmpeg: any = null;

    console.log('Starting Video Export...');
    try {
        // 1. Fetch the header (Init Segment)
        const initSegmentBlob = await db.getInitializationSegment(currentSessionId);
        if (!initSegmentBlob) {
            throw new Error("Missing initialization segment.");
        }
        const initData = await blobToUint8Array(initSegmentBlob);

        // 2. Get Raw Chunks
        const clipData = await player.getClipData(player.pointA, player.pointB);
        if(clipData.chunks.length === 0) {
            throw new Error("No video data found in selected range.");
        }

        // 3. MERGE CHUNKS IN MEMORY
        console.log("Merging chunks into single binary stream...");
        
        const chunkBuffers = await Promise.all(
            clipData.chunks.map(c => blobToUint8Array(c.data))
        );

        // Calculate total size
        const totalSize = initData.length + chunkBuffers.reduce((acc, buf) => acc + buf.length, 0);
        const mergedBuffer = new Uint8Array(totalSize);

        // Append Header first
        mergedBuffer.set(initData, 0);
        let offset = initData.length;

        // Append all Chunks sequentially
        for (const buf of chunkBuffers) {
            mergedBuffer.set(buf, offset);
            offset += buf.length;
        }

        // 4. Load FFmpeg
        const { FFmpeg } = (window as any).FFmpegWASM;
        ffmpeg = new FFmpeg();
        
        ffmpeg.on('log', ({ message }: { message: string }) => {
            console.log('FFmpeg Log:', message);
        });

        await ffmpeg.load({
            coreURL: '/cdn-proxy/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
            wasmURL: '/cdn-proxy/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
        });

        // 5. Write the Single Merged Source
        // This creates a valid-ish WebM stream structure
        await ffmpeg.writeFile('source.webm', mergedBuffer);

        // 6. Run Transcode
        // Critical Flags:
        // -fflags +genpts: Regenerate Presentation Time Stamps to fix the freeze/gaps
        // -ignore_unknown: Skip invalid data at start
        // -c:v libx264: Re-encode to H.264 (Creates valid MP4 structure)
        // -preset ultrafast: Speed
        console.log("Transcoding to MP4...");
        await ffmpeg.exec([
            '-fflags', '+genpts', 
            '-i', 'source.webm',
            '-c:v', 'libx264',
            '-preset', 'ultrafast', 
            'output.mp4'
        ]);

        // 7. Read & Download
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `clip-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Video Export complete');

    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export video. See console for details.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        
        if (ffmpeg) {
            try {
                ffmpeg.terminate();
                console.log('FFmpeg terminated.');
            } catch (e) { console.warn(e); }
        }
    }
});

frameBackwardButton?.addEventListener('click', () => {
    if (player) {
        player.userPaused = true; 
        player.frameStep('backward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});

frameForwardButton?.addEventListener('click', () => {
    if (player) {
        player.userPaused = true; 
        player.frameStep('forward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});