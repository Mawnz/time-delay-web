export interface Session {
  id: string;
  name: string;
  createdAt: number;
}

export interface Segment {
  id: number;
  sessionId: string;
  path: string;
  timestamp: number;
  duration: number;
}

export interface Thumbnail {
  id: number;
  sessionId: string;
  path: string;
  timestamp: number;
}

export interface AnnotationData {
  id: number;
  sessionId: string;
  timestamp: number; // Video time in seconds
  data: string; // JSON stringified path data
}

export interface DrawingPath {
  points: { x: number; y: number; type: 'start' | 'draw' }[];
  color: string;
  width: number;
}
