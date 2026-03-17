/**
 * Event Listener — subscribes to Ship's WebSocket event stream.
 * Implements 30-second debounce per project (per PRESEARCH.md).
 * Stub for MVP — will be wired in Step 9.
 */

export class EventListener {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private debounceMs: number;

  constructor(debounceMs = 30_000) {
    this.debounceMs = debounceMs;
  }

  /**
   * Debounce events by project ID. Returns true if this event starts a new window.
   */
  debounce(projectId: string, callback: () => void): boolean {
    const existing = this.debounceTimers.get(projectId);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimers.set(projectId, setTimeout(() => {
        this.debounceTimers.delete(projectId);
        callback();
      }, this.debounceMs));
      return false; // Existing window extended
    }

    this.debounceTimers.set(projectId, setTimeout(() => {
      this.debounceTimers.delete(projectId);
      callback();
    }, this.debounceMs));
    return true; // New window started
  }

  /** Clear all pending debounce timers */
  clear(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  get pendingCount(): number {
    return this.debounceTimers.size;
  }
}
