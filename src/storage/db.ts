import SQLite from 'react-native-sqlite-storage';
import { Session, Segment, AnnotationData, Thumbnail } from '../types';

SQLite.enablePromise(true);

let db: SQLite.SQLiteDatabase | null = null;

export const initDB = async () => {
  if (db) return;
  
  db = await SQLite.openDatabase({
    name: 'timedelay.db',
    location: 'default',
  });

  await db.executeSql('PRAGMA foreign_keys = ON;');

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      createdAt INTEGER
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      path TEXT,
      timestamp INTEGER,
      duration REAL,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS thumbnails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      path TEXT,
      timestamp INTEGER,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      timestamp REAL,
      data TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
};

export const Database = {
  // Sessions
  createSession: async (id: string, name: string) => {
    if (!db) await initDB();
    return db!.executeSql('INSERT INTO sessions (id, name, createdAt) VALUES (?, ?, ?)', [id, name, Date.now()]);
  },

  getSessions: async (): Promise<Session[]> => {
    if (!db) await initDB();
    const [results] = await db!.executeSql('SELECT * FROM sessions ORDER BY createdAt DESC');
    const sessions: Session[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      sessions.push(results.rows.item(i));
    }
    return sessions;
  },

  deleteSession: async (id: string) => {
    if (!db) await initDB();
    return db!.executeSql('DELETE FROM sessions WHERE id = ?', [id]);
  },

  updateSessionName: async (id: string, name: string) => {
    if (!db) await initDB();
    return db!.executeSql('UPDATE sessions SET name = ? WHERE id = ?', [name, id]);
  },

  // Segments
  addSegment: async (sessionId: string, path: string, timestamp: number, duration: number) => {
    if (!db) await initDB();
    return db!.executeSql(
      'INSERT INTO segments (sessionId, path, timestamp, duration) VALUES (?, ?, ?, ?)',
      [sessionId, path, timestamp, duration]
    );
  },

  getSegments: async (sessionId: string): Promise<Segment[]> => {
    if (!db) await initDB();
    const [results] = await db!.executeSql('SELECT * FROM segments WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId]);
    const segments: Segment[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      segments.push(results.rows.item(i));
    }
    return segments;
  },

  getSegmentsAfter: async (sessionId: string, timestamp: number): Promise<Segment[]> => {
    if (!db) await initDB();
    const [results] = await db!.executeSql(
      'SELECT * FROM segments WHERE sessionId = ? AND timestamp > ? ORDER BY timestamp ASC',
      [sessionId, timestamp]
    );
    const segments: Segment[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      segments.push(results.rows.item(i));
    }
    return segments;
  },

  // Thumbnails
  addThumbnail: async (sessionId: string, path: string, timestamp: number) => {
    if (!db) await initDB();
    return db!.executeSql(
      'INSERT INTO thumbnails (sessionId, path, timestamp) VALUES (?, ?, ?)',
      [sessionId, path, timestamp]
    );
  },

  getThumbnails: async (sessionId: string, startTime: number, endTime: number): Promise<Thumbnail[]> => {
    if (!db) await initDB();
    const [results] = await db!.executeSql(
      'SELECT * FROM thumbnails WHERE sessionId = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
      [sessionId, startTime, endTime]
    );
    const thumbnails: Thumbnail[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      thumbnails.push(results.rows.item(i));
    }
    return thumbnails;
  },

  // Annotations
  addAnnotation: async (sessionId: string, timestamp: number, data: string) => {
    if (!db) await initDB();
    return db!.executeSql(
      'INSERT INTO annotations (sessionId, timestamp, data) VALUES (?, ?, ?)',
      [sessionId, timestamp, data]
    );
  },

  getAnnotations: async (sessionId: string, timestamp: number): Promise<AnnotationData[]> => {
    if (!db) await initDB();
    // Get annotations for a specific video time (approximate within small window)
    const [results] = await db!.executeSql(
      'SELECT * FROM annotations WHERE sessionId = ? AND ABS(timestamp - ?) < 0.1',
      [sessionId, timestamp]
    );
    const annotations: AnnotationData[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      annotations.push(results.rows.item(i));
    }
    return annotations;
  },

  deleteAnnotation: async (id: number) => {
    if (!db) await initDB();
    return db!.executeSql('DELETE FROM annotations WHERE id = ?', [id]);
  }
};
