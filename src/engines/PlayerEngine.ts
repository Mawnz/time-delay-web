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
   * Finds the segment that should be playing based on current real-world time and delay.
   */
  public async getInitialSegment(): Promise<Segment | null> {
    if (!this.sessionId) return null;

    const targetTimestamp = Date.now() - (this.delaySeconds * 1000);
    const segments = await Database.getSegments(this.sessionId);
    
    // Find the segment that covers targetTimestamp
    const current = segments.find(s => 
      targetTimestamp >= s.timestamp && 
      targetTimestamp <= (s.timestamp + (s.duration * 1000) + 1000)
    );

    if (current) {
      this.currentSegment = current;
      return current;
    }

    return null;
  }

  public async getSegmentForTime(timeInSeconds: number): Promise<{ segment: Segment, offsetMs: number } | null> {
    if (!this.sessionId) return null;

    const segments = await Database.getSegments(this.sessionId);
    if (segments.length === 0) return null;

    const sessionStartTs = segments[0].timestamp;
    const targetTs = sessionStartTs + (timeInSeconds * 1000);

    const segment = segments.find(s => 
      targetTs >= s.timestamp && 
      targetTs <= (s.timestamp + (s.duration * 1000) + 500)
    );

    if (segment) {
      this.currentSegment = segment;
      this.nextSegment = null; // Clear pre-fetch on seek
      return {
        segment,
        offsetMs: targetTs - segment.timestamp
      };
    }

    return null;
  }

  public async getNextSegment(): Promise<Segment | null> {
    if (!this.sessionId || !this.currentSegment) return null;

    // Use a small 100ms offset to avoid finding the current segment again
    const nextSegments = await Database.getSegmentsAfter(this.sessionId, this.currentSegment.timestamp + 100);
    if (nextSegments.length > 0) {
      this.nextSegment = nextSegments[0];
      return this.nextSegment;
    }
    return null;
  }

  public onSegmentEnd(): Segment | null {
    if (this.nextSegment) {
      console.log('Transitioning to next segment:', this.nextSegment.path);
      this.currentSegment = this.nextSegment;
      const transitionTo = this.nextSegment;
      this.nextSegment = null;
      return transitionTo;
    }
    console.log('No next segment available yet at end of current.');
    return null;
  }
}

export const playerEngine = new PlayerEngine();
