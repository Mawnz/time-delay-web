import { createThumbnail } from 'react-native-create-thumbnail';
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
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const task = this.queue.shift()!;
    try {
      // Small delay to let other high-priority tasks finish
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const thumbnail = await createThumbnail({
        url: task.path,
        timeStamp: 100,
      });
      
      await Database.addThumbnail(task.sessionId, thumbnail.path, task.timestamp);
      console.log('Background Thumbnail generated:', thumbnail.path);
    } catch (e) {
      console.warn('Thumbnail Background Worker Error:', e);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

export const thumbnailQueue = new ThumbnailQueue();
