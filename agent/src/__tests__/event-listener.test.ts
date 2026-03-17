import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventListener } from '../worker/event-listener.js';

describe('EventListener debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires callback after debounce window', () => {
    const listener = new EventListener(1000);
    const callback = vi.fn();

    listener.debounce('proj-1', callback);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledOnce();

    listener.clear();
  });

  it('resets timer on repeated events for same project', () => {
    const listener = new EventListener(1000);
    const callback = vi.fn();

    listener.debounce('proj-1', callback);
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    // Second event resets the window
    listener.debounce('proj-1', callback);
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledOnce();

    listener.clear();
  });

  it('tracks separate timers for different projects', () => {
    const listener = new EventListener(1000);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    listener.debounce('proj-1', cb1);
    listener.debounce('proj-2', cb2);

    expect(listener.pendingCount).toBe(2);

    vi.advanceTimersByTime(1000);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(listener.pendingCount).toBe(0);

    listener.clear();
  });

  it('returns true for new debounce window, false for existing', () => {
    const listener = new EventListener(1000);
    const callback = vi.fn();

    const first = listener.debounce('proj-1', callback);
    expect(first).toBe(true);

    const second = listener.debounce('proj-1', callback);
    expect(second).toBe(false);

    listener.clear();
  });

  it('clear() cancels all pending timers', () => {
    const listener = new EventListener(1000);
    const callback = vi.fn();

    listener.debounce('proj-1', callback);
    listener.debounce('proj-2', callback);
    expect(listener.pendingCount).toBe(2);

    listener.clear();
    expect(listener.pendingCount).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('uses default 30-second debounce', () => {
    const listener = new EventListener();
    const callback = vi.fn();

    listener.debounce('proj-1', callback);
    vi.advanceTimersByTime(29_000);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(callback).toHaveBeenCalledOnce();

    listener.clear();
  });
});
