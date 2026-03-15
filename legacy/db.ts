export class DB {
    private db: IDBDatabase | null = null;

    constructor(private dbName: string) { }

    async open() {
        return new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 8); // Incremented version
            request.onerror = (event) => {
                console.error('DB open error:', event);
                reject("Error opening db");
            };
            request.onsuccess = () => {
                this.db = request.result;
                console.log('DB opened successfully');
                resolve();
            };
            request.onupgradeneeded = (event) => {
                console.log('DB upgrade needed');
                const db = (event.target as any).result;

                // Graceful upgrade: only create stores that do not already exist.
                // This preserves existing data when the schema version is bumped.
                if (!db.objectStoreNames.contains('chunks')) {
                    const chunkStore = db.createObjectStore("chunks", { keyPath: 'id', autoIncrement: true });
                    chunkStore.createIndex('session_ts', ['sessionId', 'timestamp'], { unique: false });
                }

                if (!db.objectStoreNames.contains('thumbnails')) {
                    const thumbnailStore = db.createObjectStore("thumbnails", { keyPath: 'id', autoIncrement: true });
                    thumbnailStore.createIndex('session_ts', ['sessionId', 'timestamp'], { unique: false });
                }

                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore("sessions", { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('annotations')) {
                    const annotationStore = db.createObjectStore("annotations", { keyPath: 'id', autoIncrement: true });
                    annotationStore.createIndex('session_timestamp', ['sessionId', 'timestamp'], { unique: false });
                }

                if (!db.objectStoreNames.contains('initializationSegments')) {
                    db.createObjectStore("initializationSegments", { keyPath: 'sessionId' });
                }
            };
        });
    }

    async addChunk(sessionId: string, chunk: Blob) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["chunks"], "readwrite");
            const store = transaction.objectStore("chunks");
            const request = store.add({ sessionId, timestamp: Date.now(), data: chunk });
            request.onerror = () => reject("Error adding chunk");
            request.onsuccess = () => resolve();
        });
    }

    async addThumbnail(sessionId: string, thumbnail: string) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["thumbnails"], "readwrite");
            const store = transaction.objectStore("thumbnails");
            const request = store.add({ sessionId, timestamp: Date.now(), data: thumbnail });
            request.onerror = () => reject("Error adding thumbnail");
            request.onsuccess = () => resolve();
        });
    }

    async getChunksAfter(sessionId: string, timestamp: number, callback: (chunk: Blob, key: number) => void) {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["chunks"], "readonly");
        const store = transaction.objectStore("chunks");
        const index = store.index('session_ts');
        const range = IDBKeyRange.lowerBound([sessionId, timestamp], true); // Exclusive
        const request = index.openCursor(range);

        request.onerror = () => console.error('Error opening cursor for chunks');
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                // Ensure we only get chunks for the current session
                if (cursor.value.sessionId === sessionId) {
                    callback(cursor.value.data, cursor.value.timestamp);
                    cursor.continue();
                }
            }
        };
    }

    async getThumbnailsAfter(sessionId: string, timestamp: number, callback: (thumbnail: string, key: number) => void) {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["thumbnails"], "readonly");
        const store = transaction.objectStore("thumbnails");
        const index = store.index('session_ts');
        const range = IDBKeyRange.lowerBound([sessionId, timestamp], true); // Exclusive
        const request = index.openCursor(range);

        request.onerror = () => console.error('Error opening cursor for thumbnails');
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (cursor.value.sessionId === sessionId) {
                    callback(cursor.value.data, cursor.value.timestamp);
                    cursor.continue();
                }
            }
        };
    }

    // --- Other methods remain the same, just need to add the new init segment and clear logic ---

    async addInitializationSegment(sessionId: string, chunk: Blob) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["initializationSegments"], "readwrite");
            const store = transaction.objectStore("initializationSegments");
            const request = store.put({ sessionId, data: chunk }); // Use put to overwrite if it exists
            request.onerror = () => reject("Error adding initialization segment");
            request.onsuccess = () => resolve();
        });
    }

    async getInitializationSegment(sessionId: string): Promise<Blob | undefined> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["initializationSegments"], "readonly");
        const store = transaction.objectStore("initializationSegments");
        const request = store.get(sessionId);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting initialization segment");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result?.data);
        });
    }

    async addAnnotation(sessionId: string, timestamp: number, data: any) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["annotations"], "readwrite");
            const store = transaction.objectStore("annotations");
            const request = store.add({ sessionId, timestamp, data });
            request.onerror = () => reject("Error adding annotation");
            request.onsuccess = () => resolve();
        });
    }

    async getAnnotationsForTimestamp(sessionId: string, timestamp: number, callback: (annotations: any[]) => void) {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["annotations"], "readonly");
        const store = transaction.objectStore("annotations");
        const index = store.index('session_timestamp');
        const range = IDBKeyRange.bound([sessionId, timestamp - 0.5], [sessionId, timestamp + 0.5]);
        const request = index.getAll(range);
        request.onerror = () => console.error('Error getting annotations');
        request.onsuccess = (event) => callback((event.target as IDBRequest).result);
    }

    async getSession(sessionId: string): Promise<{ id: string, name: string, createdAt: number } | undefined> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["sessions"], "readonly");
        const store = transaction.objectStore("sessions");
        const request = store.get(sessionId);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting session");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async getAllChunksForSession(sessionId: string): Promise<any[]> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["chunks"], "readonly");
        const store = transaction.objectStore("chunks");
        const index = store.index('session_ts');
        const range = IDBKeyRange.only(sessionId);
        const request = index.getAll(range);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting all chunks for session");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async getAllThumbnailsForSession(sessionId: string): Promise<any[]> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["thumbnails"], "readonly");
        const store = transaction.objectStore("thumbnails");
        const index = store.index('session_ts');
        const range = IDBKeyRange.only(sessionId);
        const request = index.getAll(range);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting all thumbnails for session");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async getAllAnnotationsForSession(sessionId: string): Promise<any[]> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["annotations"], "readonly");
        const store = transaction.objectStore("annotations");
        const index = store.index('session_timestamp');
        // FIX B4: Use a properly bounded range — lowerBound alone leaks into other sessions
        const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity]);
        const request = index.getAll(range);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting all annotations for session");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async getChunksBetween(sessionId: string, start: number, end: number): Promise<any[]> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["chunks"], "readonly");
        const store = transaction.objectStore("chunks");
        const index = store.index('session_ts');
        const range = IDBKeyRange.bound([sessionId, start], [sessionId, end]);
        const request = index.getAll(range);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting chunks between timestamps");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async getThumbnailsBetween(sessionId: string, start: number, end: number): Promise<any[]> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["thumbnails"], "readonly");
        const store = transaction.objectStore("thumbnails");
        const index = store.index('session_ts');
        const range = IDBKeyRange.bound([sessionId, start], [sessionId, end]);
        const request = index.getAll(range);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting thumbnails between timestamps");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async getAnnotationsBetween(sessionId: string, start: number, end: number): Promise<any[]> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["annotations"], "readonly");
        const store = transaction.objectStore("annotations");
        const index = store.index('session_timestamp');
        const range = IDBKeyRange.bound([sessionId, start], [sessionId, end]);
        const request = index.getAll(range);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting annotations between timestamps");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }

    async addSession(session: { id: string, name: string, createdAt: number }) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["sessions"], "readwrite");
            const store = transaction.objectStore("sessions");
            const request = store.add(session);
            request.onerror = () => reject("Error adding session");
            request.onsuccess = () => resolve();
        });
    }

    async updateSessionStartTime(sessionId: string, startTime: number) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["sessions"], "readwrite");
            const store = transaction.objectStore("sessions");
            const request = store.get(sessionId);
            request.onerror = () => reject("Error getting session for update");
            request.onsuccess = (event) => {
                const session = (event.target as IDBRequest).result;
                if (session) {
                    session.createdAt = startTime;
                    const putReq = store.put(session);
                    putReq.onerror = () => reject("Error updating session");
                    putReq.onsuccess = () => resolve();
                } else {
                    reject("Session not found");
                }
            };
        });
    }

    async getAllSessions(callback: (sessions: { id: string, name: string, createdAt: number }[]) => void) {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["sessions"], "readonly");
        const store = transaction.objectStore("sessions");
        const request = store.getAll();
        request.onerror = () => console.error('Error getting all sessions');
        request.onsuccess = (event) => callback((event.target as IDBRequest).result);
    }

    async clear() {
        console.log('Clearing DB');
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const stores = ["chunks", "thumbnails", "sessions", "annotations", "initializationSegments"];
            const transaction = this.db.transaction(stores, "readwrite");
            let successCount = 0;
            const checkSuccess = () => {
                successCount++;
                if (successCount === stores.length) {
                    console.log('DB cleared');
                    resolve();
                }
            };
            stores.forEach(storeName => {
                const request = transaction.objectStore(storeName).clear();
                request.onerror = (event) => {
                    console.error(`Error clearing ${storeName}:`, event);
                    reject(`Error clearing ${storeName}`);
                };
                request.onsuccess = checkSuccess;
            });
        });
    }

    // ============================================================
    // Native-path methods (file-path based, no Blob storage)
    // ============================================================

    /**
     * Store a reference to a native segment file in the chunks store.
     * On native, `filePath` replaces `data` (Blob).
     */
    async addSegmentRef(sessionId: string, filePath: string, timestamp: number) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["chunks"], "readwrite");
            const store = transaction.objectStore("chunks");
            const request = store.add({ sessionId, timestamp, filePath });
            request.onerror = () => reject("Error adding segment ref");
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Store a reference to a native thumbnail file.
     */
    async addThumbnailRef(sessionId: string, filePath: string, timestamp: number) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["thumbnails"], "readwrite");
            const store = transaction.objectStore("thumbnails");
            const request = store.add({ sessionId, timestamp, filePath });
            request.onerror = () => reject("Error adding thumbnail ref");
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Store the path to the native init segment file.
     */
    async addInitSegmentPath(sessionId: string, filePath: string) {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) return reject("DB not open");
            const transaction = this.db.transaction(["initializationSegments"], "readwrite");
            const store = transaction.objectStore("initializationSegments");
            const request = store.put({ sessionId, filePath });
            request.onerror = () => reject("Error adding init segment path");
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Get segments (file-path based) after a given timestamp.
     * Works for both native (filePath) and web (data Blob) entries.
     */
    async getSegmentsAfter(sessionId: string, timestamp: number,
        callback: (entry: { filePath?: string; data?: Blob; timestamp: number }, timestamp: number) => void
    ) {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["chunks"], "readonly");
        const store = transaction.objectStore("chunks");
        const index = store.index('session_ts');
        const range = IDBKeyRange.lowerBound([sessionId, timestamp], true);
        const request = index.openCursor(range);

        request.onerror = () => console.error('Error opening cursor for segments');
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (cursor.value.sessionId === sessionId) {
                    callback(cursor.value, cursor.value.timestamp);
                    cursor.continue();
                }
            }
        };
    }

    /**
     * Get the init segment — returns either a Blob (web) or a file path (native).
     */
    async getInitSegment(sessionId: string): Promise<{ data?: Blob; filePath?: string } | undefined> {
        if (!this.db) throw new Error("DB not open");
        const transaction = this.db.transaction(["initializationSegments"], "readonly");
        const store = transaction.objectStore("initializationSegments");
        const request = store.get(sessionId);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject("Error getting init segment");
            request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
        });
    }
}


