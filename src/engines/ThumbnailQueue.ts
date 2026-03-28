import { createThumbnail } from 'react-native-create-thumbnail';
import { InteractionManager } from 'react-native';
import { Database } from '../storage/db';

interface ThumbnailTask {
  sessionId: string;
  path: string;
  timestamp: number;
}

export class ThumbnailQueue {
  private queue: ThumbnailTask[] = [];
  private isProcessing = false;

  public addTask(task: ThumbnailTask) {
    this.queue.push(task);
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const task = this.queue.shift()!;
    try {
      // Wait for all in-flight interactions (animations, camera segment switches)
      // to complete before doing any heavy work — prevents the thumbnail decode
      // from coinciding with the camera surface switch and causing a flash.
      await new Promise<void>(resolve =>
        InteractionManager.runAfterInteractions(() => resolve()),
      );
      // Additional idle buffer so the next segment has fully initialised
      await new Promise(resolve => setTimeout(resolve, 2000));

      const thumbnail = await createThumbnail({
        url: task.path,
        timeStamp: 500, // grab from 500ms in to avoid black first frame
      });

      await Database.addThumbnail(task.sessionId, thumbnail.path, task.timestamp);
      console.log('Thumbnail generated:', thumbnail.path);
    } catch (e) {
      console.warn('Thumbnail queue error:', e);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

export const thumbnailQueue = new ThumbnailQueue();
