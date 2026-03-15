import { Database } from '../storage/db';
import { Segment } from '../types';

export class PlayerEngine {
  private sessionId: string | null = null;
  private delaySeconds = 5;
  private currentSegment: Segment | null = null;
  private nextSegment: Segment | null = null;

  constructor() {}

  public setSession(sessionId: string) {
    this.sessionId = sessionId;
    this.currentSegment = null;
    this.nextSegment = null;
  }

  public setDelay(seconds: number) {
    this.delaySeconds = seconds;
  }

  /**
   * Optimized: Jump straight to the segment covering (RealTime - Delay).
   */
  public async getInitialSegment(): Promise<Segment | null> {
    if (!this.sessionId) return null;

    const targetTimestamp = Date.now() - (this.delaySeconds * 1000);
    const current = await Database.getSegmentAtTime(this.sessionId, targetTimestamp);

    if (current) {
      this.currentSegment = current;
      return current;
    }

    return null;
  }

  /**
   * Optimized: Target a specific timestamp without scanning arrays.
   */
  public async getSegmentForTime(timeInSeconds: number): Promise<{ segment: Segment, offsetMs: number } | null> {
    if (!this.sessionId) return null;

    const sessionStartTs = await Database.getSessionStart(this.sessionId);
    if (sessionStartTs === null) return null;

    const targetTs = sessionStartTs + (timeInSeconds * 1000);
    const segment = await Database.getSegmentAtTime(this.sessionId, targetTs);

    if (segment) {
      this.currentSegment = segment;
      this.nextSegment = null;
      return {
        segment,
        offsetMs: Math.max(0, targetTs - segment.timestamp)
      };
    }

    return null;
  }

  public async getNextSegment(): Promise<Segment | null> {
    if (!this.sessionId || !this.currentSegment) return null;

    const nextSegments = await Database.getSegmentsAfter(this.sessionId, this.currentSegment.timestamp + 100);
    if (nextSegments.length > 0) {
      this.nextSegment = nextSegments[0];
      return this.nextSegment;
    }
    return null;
  }

  public onSegmentEnd(): Segment | null {
    if (this.nextSegment) {
      this.currentSegment = this.nextSegment;
      const transitionTo = this.nextSegment;
      this.nextSegment = null;
      return transitionTo;
    }
    return null;
  }
}

export const playerEngine = new PlayerEngine();
