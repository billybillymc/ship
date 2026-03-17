/**
 * Event Listener — subscribes to Ship's /events WebSocket stream.
 * Implements 30-second debounce per project (per PRESEARCH.md).
 *
 * Listens for `issue:created` and `issue:updated` events broadcast
 * by the Ship API when issues are mutated.
 */
import WebSocket from 'ws';

export interface IssueEvent {
  type: 'issue:created' | 'issue:updated';
  data: {
    issue_id: string;
    project_ids: string[];
    assignee_id: string | null;
    changed_fields?: string[];
  };
}

export type GraphRunCallback = (projectId: string, assigneeIds: string[]) => Promise<void>;

export class EventListener {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private debounceMs: number;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onGraphRun: GraphRunCallback | null = null;

  constructor(debounceMs = 30_000) {
    this.debounceMs = debounceMs;
  }

  /**
   * Connect to Ship's /events WebSocket and start listening for issue events.
   */
  connect(shipWsUrl: string, token: string, onGraphRun: GraphRunCallback): void {
    this.onGraphRun = onGraphRun;
    this._connect(shipWsUrl, token);
  }

  private _connect(shipWsUrl: string, token: string): void {
    const url = `${shipWsUrl}/events?token=${token}`;
    console.log(`[EventListener] Connecting to ${shipWsUrl}/events...`);

    try {
      this.ws = new WebSocket(url);
    } catch (error) {
      console.error('[EventListener] Failed to create WebSocket:', error);
      this._scheduleReconnect(shipWsUrl, token);
      return;
    }

    this.ws.on('open', () => {
      console.log('[EventListener] Connected to Ship events');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as { type: string; data: Record<string, unknown> };
        this._handleMessage(message);
      } catch (error) {
        console.error('[EventListener] Failed to parse message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[EventListener] Disconnected from Ship events');
      this._scheduleReconnect(shipWsUrl, token);
    });

    this.ws.on('error', (error: Error) => {
      console.error('[EventListener] WebSocket error:', error.message);
    });
  }

  private _scheduleReconnect(shipWsUrl: string, token: string): void {
    if (this.reconnectTimer) return;
    console.log('[EventListener] Reconnecting in 5s...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect(shipWsUrl, token);
    }, 5000);
  }

  private _handleMessage(message: { type: string; data: Record<string, unknown> }): void {
    if (message.type === 'connected' || message.type === 'pong') return;

    if (message.type === 'issue:created' || message.type === 'issue:updated') {
      const event: IssueEvent = {
        type: message.type as IssueEvent['type'],
        data: {
          issue_id: message.data['issue_id'] as string,
          project_ids: (message.data['project_ids'] as string[]) ?? [],
          assignee_id: (message.data['assignee_id'] as string) ?? null,
          changed_fields: message.data['changed_fields'] as string[] | undefined,
        },
      };
      this._processEvent(event);
    }
  }

  private _processEvent(event: IssueEvent): void {
    const assigneeIds = event.data.assignee_id ? [event.data.assignee_id] : [];

    for (const projectId of event.data.project_ids) {
      this.debounce(projectId, async () => {
        if (this.onGraphRun) {
          try {
            await this.onGraphRun(projectId, assigneeIds);
          } catch (error) {
            console.error(`[EventListener] Graph run failed for project ${projectId}:`, error);
          }
        }
      });
    }

    // If no project association, still process for person-level checks
    if (event.data.project_ids.length === 0 && assigneeIds.length > 0) {
      this.debounce(`person:${assigneeIds[0]}`, async () => {
        if (this.onGraphRun) {
          try {
            await this.onGraphRun('', assigneeIds);
          } catch (error) {
            console.error(`[EventListener] Graph run failed for person:`, error);
          }
        }
      });
    }
  }

  /**
   * Debounce events by key (project ID or person ID).
   * Returns true if this event starts a new window.
   */
  debounce(key: string, callback: () => void): boolean {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimers.set(key, setTimeout(() => {
        this.debounceTimers.delete(key);
        callback();
      }, this.debounceMs));
      return false;
    }

    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key);
      callback();
    }, this.debounceMs));
    return true;
  }

  /** Clear all pending debounce timers and disconnect */
  clear(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get pendingCount(): number {
    return this.debounceTimers.size;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
