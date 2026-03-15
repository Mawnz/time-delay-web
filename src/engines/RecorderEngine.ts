import { Camera } from 'react-native-vision-camera';
import { Database } from '../storage/db';
import { thumbnailQueue } from './ThumbnailQueue';

export interface RecorderOptions {
  sessionId: string;
  segmentDurationMs: number;
}

export class RecorderEngine {
  private isRecording = false;
  private currentSessionId: string | null = null;
  private segmentDuration = 5000; // 5s segments for better performance
  private cameraRef: React.RefObject<Camera> | null = null;

  constructor() {}

  public setCameraRef(ref: React.RefObject<Camera>) {
    this.cameraRef = ref;
  }

  public async start(options: RecorderOptions) {
    if (this.isRecording) return;
    this.isRecording = true;
    this.currentSessionId = options.sessionId;
    this.segmentDuration = options.segmentDurationMs || 5000;

    this.recordSegment();
  }

  private recordSegment = async () => {
    if (!this.isRecording || !this.cameraRef?.current || !this.currentSessionId) return;

    const sessionId = this.currentSessionId;
    const startTime = Date.now();

    try {
      this.cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          const duration = (Date.now() - startTime) / 1000;
          let path = video.path;
          if (!path.startsWith('file://')) path = 'file://' + path;
          
          await Database.addSegment(sessionId, path, startTime, duration);
          console.log(`Segment saved: ${path} (${duration}s)`);

          // Delegate to background worker
          thumbnailQueue.addTask({ sessionId, path, timestamp: startTime });
        },
        onRecordingError: (error) => {
          console.error('Recording Error:', error);
        },
      });

      // Wait for segment duration
      setTimeout(async () => {
        if (this.isRecording && this.cameraRef?.current) {
          try {
            await this.cameraRef.current.stopRecording();
          } catch (e) {
            console.error('Error stopping segment:', e);
          }
          // Start next segment immediately
          this.recordSegment();
        }
      }, this.segmentDuration);

    } catch (e) {
      console.error('Failed to start segment recording:', e);
      this.isRecording = false;
    }
  };

  public async stop() {
    this.isRecording = false;
    if (this.cameraRef?.current) {
      try {
        await this.cameraRef.current.stopRecording();
      } catch (e) {
        console.warn('Stop recording warning:', e);
      }
    }
    this.currentSessionId = null;
  }
}

export const recorderEngine = new RecorderEngine();
