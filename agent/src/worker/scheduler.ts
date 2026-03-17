/**
 * Scheduler — cron/setInterval for scheduled runs.
 * Stub for MVP — will be implemented in Step 17 (post-MVP).
 */

export class Scheduler {
  private intervals: NodeJS.Timeout[] = [];

  /** Schedule a callback to run at a fixed interval */
  schedule(name: string, intervalMs: number, callback: () => Promise<void>): void {
    console.log(`Scheduled "${name}" every ${intervalMs / 1000}s`);
    const id = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`Scheduled job "${name}" failed:`, error);
      }
    }, intervalMs);
    this.intervals.push(id);
  }

  /** Clear all scheduled jobs */
  clear(): void {
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals = [];
  }
}
