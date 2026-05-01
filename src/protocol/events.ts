/**
 * Protocol Event System
 * 
 * Event emitter for protocol state changes and checkpoint events.
 * Part of the Protocol Enforcement v4.0 state machine foundation.
 */

export type ProtocolEventType = 
  | 'state.changed'
  | 'state.blocked'
  | 'checkpoint.validated'
  | 'checkpoint.failed'
  | 'checkpoint.waived'
  | 'protocol.completed'
  | 'protocol.error';

export interface ProtocolEvent {
  type: ProtocolEventType;
  sessionId: string;
  timestamp: number;
  payload: unknown;
}

export type EventHandler = (event: ProtocolEvent) => void;

/**
 * Simple event emitter for protocol events.
 * Supports multiple handlers per event type.
 */
export class ProtocolEventBus {
  private listeners: Map<ProtocolEventType, Set<EventHandler>> = new Map();

  /**
   * Register an event handler
   */
  on(event: ProtocolEventType, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  off(event: ProtocolEventType, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  emit(event: ProtocolEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Event handler error for ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Remove all handlers for a specific event type
   */
  clear(event?: ProtocolEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of handlers registered for an event
   */
  listenerCount(event: ProtocolEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/**
 * Create a protocol event with standard fields
 */
export function createProtocolEvent(
  sessionId: string,
  type: ProtocolEventType,
  payload: unknown
): ProtocolEvent {
  return {
    type,
    sessionId,
    timestamp: Date.now(),
    payload,
  };
}